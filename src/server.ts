// List Customers (GET /api/customers)

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  addCustomer,
  addLedgerEntry,
  getCustomerSummary,
  getLedgerAging,
  getLedgerEntries,
  initDb,
  listAuditLogs,
  listCustomers,
  updateCustomer,
  deleteLedgerEntry,
  addShop,
  findShopByEmail
} from "./db";

const toCsvValue = (value: string | number | null): string => {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.includes("\"") || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
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
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-khata-key";

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }
    (req as any).shopId = decoded.shopId;
    next();
  });
};

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
    await addShop({ shop_name, owner_name, email, password_hash });
    
    res.status(201).json({ message: "Shop created successfully" });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const shop = await findShopByEmail(email);
    if (!shop || !(await bcrypt.compare(password, shop.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ shopId: shop.id }, JWT_SECRET, { expiresIn: "7d" });
    
    res.cookie("token", token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: "Login successful", 
      token, 
      shop: { id: shop.id, name: shop.shop_name, owner: shop.owner_name } 
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers", authenticateToken, async (req: Request, res: Response) => {
  const shopId = (req as any).shopId;
  const customers = await listCustomers(shopId);
  res.json(customers);
});

app.post("/api/customers", authenticateToken, async (req, res) => {
  try {
    const shopId = (req as any).shopId;
    const customer = await addCustomer({ ...req.body, shop_id: shopId });
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/customers/:id", authenticateToken, async (req, res) => {
  try {
    const shopId = (req as any).shopId;
    const customer = await updateCustomer({
      ...req.body,
      id: Number(req.params.id),
      shop_id: shopId
    });
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/ledger/:customerId", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const entries = await getLedgerEntries(shopId, Number(req.params.customerId));
  res.json(entries);
});

app.post("/api/ledger", authenticateToken, async (req, res) => {
  try {
    const shopId = (req as any).shopId;
    const entry = await addLedgerEntry({ ...req.body, shop_id: shopId });
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/ledger/:id", authenticateToken, async (req, res) => {
  try {
    const shopId = (req as any).shopId;
    await deleteLedgerEntry(shopId, Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/summary/:customerId", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const summary = await getCustomerSummary(shopId, Number(req.params.customerId));
  res.json(summary);
});

app.get("/api/aging/:customerId", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const aging = await getLedgerAging(shopId, Number(req.params.customerId));
  res.json(aging);
});

app.get("/api/reports/aging", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const customers = await listCustomers(shopId);
  const agingData = await Promise.all(
    customers.map(async (c) => ({
      customer: c,
      aging: await getLedgerAging(shopId, c.id)
    }))
  );
  res.json(agingData);
});

app.get("/api/audit-logs", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const logs = await listAuditLogs(shopId);
  res.json(logs);
});

app.get("/api/reports/customers/csv", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const customers = await listCustomers(shopId);
  const data = await Promise.all(
    customers.map(async (c: { id: number; name: string; phone: string | null; address: string | null }) => {
      const s = await getCustomerSummary(shopId, c.id);
      return { ...c, ...s };
    })
  );

  let csv = "ID,Name,Phone,Address,Total Debit,Total Credit,Balance\n";
  data.forEach((row: { id: number; name: string; phone: string | null; address: string | null; totalDebit: number; totalCredit: number; balance: number }) => {
    csv += `${row.id},${toCsvValue(row.name)},${toCsvValue(row.phone)},${toCsvValue(row.address)},${row.totalDebit},${row.totalCredit},${row.balance}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
  res.send(csv);
});

app.get("/api/export/ledger/:customerId.csv", authenticateToken, async (req, res) => {
  const shopId = (req as any).shopId;
  const customerId = Number(req.params.customerId);
  const entries = await getLedgerEntries(shopId, customerId);
  
  let csv = "Date,Type,Item,Quantity,Rate,Amount,Note\n";
  entries.forEach((row: { created_at: string; entry_type: string; item_name: string; quantity: number; rate: number | null; amount: number; note: string | null }) => {
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
  app.get("/", (_req: Request, res: Response) => {
    res.redirect("http://localhost:5173");
  });
}

// Fallback for SPA (Should be last)
app.get("*", (req: Request, res: Response, next: NextFunction) => {
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

if (process.env.NODE_ENV !== 'test') {
  initDb().then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  });
}

export { app };

