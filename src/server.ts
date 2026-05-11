import cors from "cors";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { authenticateToken, generateToken, AuthRequest } from "./auth";
import {
  addCustomer,
  addCategory,
  addBrand,
  addItem,
  addLedgerEntry,
  getCustomerSummary,
  getLedgerAging,
  getLedgerEntries,
  initDb,
  listAuditLogs,
  listBrands,
  listCategories,
  listCustomers,
  updateCustomer,
  deleteLedgerEntry,
  addShop,
  findShopByEmail,
  getAllItems
} from "./db";

const toCsvValue = (value: string | number | null): string => {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes("\"") || text.includes(",") || text.includes("\n")) {
    return `"\${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const app = express();
const port = Number(process.env.PORT) || 5174;
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  process.env.CLIENT_URL
].filter(Boolean) as string[];

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

// Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { shop_name, owner_name, email, password } = req.body;
    if (!email || !password || !shop_name || !owner_name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existing = await findShopByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const shop = await addShop({ shop_name, owner_name, email, password_hash });
    
    res.status(201).json({ message: "Shop created successfully" });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const shop = await findShopByEmail(email);
    
    if (!shop || !(await bcrypt.compare(password, shop.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken({ 
      shopId: shop.id, 
      email: shop.email, 
      shopName: shop.shop_name 
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      shopId: shop.id, 
      shopName: shop.shop_name,
      ownerName: shop.owner_name
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json(req.user);
});

// Business Routes
app.get("/api/customers", authenticateToken, async (req: AuthRequest, res) => {
  res.json(await listCustomers(req.user!.shopId));
});

app.post("/api/customers", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const customer = await addCustomer({
      shop_id: req.user!.shopId,
      name: String(req.body?.name || ""),
      phone: req.body?.phone ? String(req.body.phone) : undefined,
      address: req.body?.address ? String(req.body.address) : undefined
    });
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/customers/:id", authenticateToken, async (req: AuthRequest, res) => {
  const customerId = Number(req.params.id);
  try {
    const customer = await updateCustomer({
      id: customerId,
      shop_id: req.user!.shopId,
      name: String(req.body?.name || ""),
      phone: req.body?.phone ? String(req.body.phone) : null,
      address: req.body?.address ? String(req.body.address) : null
    });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers/:id/entries", authenticateToken, async (req: AuthRequest, res) => {
  const customerId = Number(req.params.id);
  res.json(await getLedgerEntries(req.user!.shopId, customerId));
});

app.post("/api/customers/:id/entries", authenticateToken, async (req: AuthRequest, res) => {
  const customerId = Number(req.params.id);
  try {
    const entry = await addLedgerEntry({
      shop_id: req.user!.shopId,
      customerId,
      itemId: req.body?.itemId ? Number(req.body.itemId) : null,
      itemName: String(req.body?.itemName || ""),
      quantity: Number(req.body?.quantity || 0),
      rate: req.body?.rate !== undefined ? Number(req.body.rate) : null,
      unit: req.body?.unit ? String(req.body.unit) : null,
      entryType: req.body?.entryType === "credit" ? "credit" : "debit",
      affectsBalance: req.body?.affectsBalance !== false,
      note: req.body?.note ? String(req.body.note) : undefined
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/customers/:customerId/entries/:entryId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    await deleteLedgerEntry(req.user!.shopId, Number(req.params.entryId));
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers/:id/summary", authenticateToken, async (req: AuthRequest, res) => {
  res.json(await getCustomerSummary(req.user!.shopId, Number(req.params.id)));
});

app.get("/api/customers/:id/aging", authenticateToken, async (req: AuthRequest, res) => {
  res.json(await getLedgerAging(req.user!.shopId, Number(req.params.id)));
});

app.get("/api/audit-logs", authenticateToken, async (req: AuthRequest, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(await listAuditLogs(req.user!.shopId, limit));
});

// CSV Export (Protected)
app.get("/api/export/customers.csv", authenticateToken, async (req: AuthRequest, res) => {
  const customers = await listCustomers(req.user!.shopId);
  const data = await Promise.all(
    customers.map(async (c: any) => {
      const s = await getCustomerSummary(req.user!.shopId, c.id);
      return { ...c, ...s };
    })
  );

  let csv = "ID,Name,Phone,Address,Total Debit,Total Credit,Balance\n";
  data.forEach((row: any) => {
    csv += `${row.id},${toCsvValue(row.name)},${toCsvValue(row.phone)},${toCsvValue(row.address)},${row.totalDebit},${row.totalCredit},${row.balance}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
  res.send(csv);
});

app.get("/api/export/ledger/:customerId.csv", authenticateToken, async (req: AuthRequest, res) => {
  const customerId = Number(req.params.customerId);
  const entries = await getLedgerEntries(req.user!.shopId, customerId);
  
  let csv = "Date,Type,Item,Quantity,Rate,Amount,Note\n";
  entries.forEach((row: any) => {
    csv += `${row.created_at},${row.entry_type},${toCsvValue(row.item_name)},${row.quantity},${row.rate || ""},${row.amount},${toCsvValue(row.note)}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=ledger-${customerId}.csv`);
  res.send(csv);
});

// Static files for client
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));

if (process.env.NODE_ENV !== "production") {
  app.get("/", (_req, res) => {
    res.redirect("http://localhost:5173");
  });
}

// Fallback for SPA (Should be last)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
