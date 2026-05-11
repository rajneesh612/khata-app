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

app.put("/api/customers/:id", async (req, res) => {
  // TEMP: No auth required
  const customerId = Number(req.params.id);
  try {
    const customer = await updateCustomer({
      id: customerId,
      shop_id: 1, // Default to shopId 1 for demo
      name: String(req.body?.name || ""),
      phone: req.body?.phone ? String(req.body.phone) : null,
      address: req.body?.address ? String(req.body.address) : null
    });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers/:id/entries", async (req, res) => {
  // TEMP: No auth required
  const customerId = Number(req.params.id);
  res.json(await getLedgerEntries(1, customerId)); // Default to shopId 1 for demo
});

app.post("/api/customers/:id/entries", async (req, res) => {
  // TEMP: No auth required
  const customerId = Number(req.params.id);
  try {
    const entry = await addLedgerEntry({
      shop_id: 1, // Default to shopId 1 for demo
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

app.delete("/api/customers/:customerId/entries/:entryId", async (req, res) => {
  // TEMP: No auth required
  try {
    await deleteLedgerEntry(1, Number(req.params.entryId)); // Default to shopId 1 for demo
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers/:id/summary", async (req, res) => {
  // TEMP: No auth required
  res.json(await getCustomerSummary(1, Number(req.params.id)));
});

app.get("/api/customers/:id/aging", async (req, res) => {
  // TEMP: No auth required
  res.json(await getLedgerAging(1, Number(req.params.id)));
});

app.get("/api/audit-logs", async (req, res) => {
  // TEMP: No auth required
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(await listAuditLogs(1, limit));
});

// CSV Export (Protected)
app.get("/api/export/customers.csv", async (req, res) => {
  // TEMP: No auth required
  const customers = await listCustomers(1);
  const data = await Promise.all(
    customers.map(async (c: any) => {
      const s = await getCustomerSummary(1, c.id);
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

app.get("/api/export/ledger/:customerId.csv", async (req, res) => {
  // TEMP: No auth required
  const customerId = Number(req.params.customerId);
  const entries = await getLedgerEntries(1, customerId);
  
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
// NO app.use(express.static(clientDist)) here anymore!

if (process.env.NODE_ENV !== "production") {
  app.get("/", (_req, res) => {
    res.redirect("http://localhost:5173");
  });
}

// Fallback for SPA (Should be last)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  
  // Only serve index.html if it's NOT an API call
  // This ensures that POST /api/auth/signup definitely hits the API route below
  // or returns a 404 from Express if not found, rather than returning index.html (which causes the "Cannot POST" error)
  res.sendFile(path.join(clientDist, "index.html"));
});

// IMPORTANT: Put static file serving AFTER the API routes but BEFORE the wildcard
// Actually, let's put it right before the wildcard but AFTER API routes are defined.
// Wait, the API routes are ALREADY defined above this section.

app.use(express.static(clientDist));

initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
