// List Customers (GET /api/customers)

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
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
  // Add Customer (POST /api/customers)
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


  // Add Customer (POST /api/customers)
  app.post("/api/customers", async (req: Request, res: Response) => {
    try {
      const { name, phone, address } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Customer name is required" });
      }
      const customer = await addCustomer({
        shop_id: 1, // Default to shopId 1 for demo
        name: String(name),
        phone: phone ? String(phone) : undefined,
        address: address ? String(address) : undefined
      });
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
// Auth Routes
      // List Customers (GET /api/customers) -- moved after app initialization
      app.get("/api/customers", async (req: Request, res: Response) => {
        // TEMP: No auth required
        const customers = await listCustomers(1); // Default to shopId 1 for demo
        res.json(customers);
      });
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
    customers.map(async (c: { id: number; name: string; phone: string | null; address: string | null }) => {
      const s = await getCustomerSummary(1, c.id);
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

app.get("/api/export/ledger/:customerId.csv", async (req, res) => {
  // TEMP: No auth required
  const customerId = Number(req.params.customerId);
  const entries = await getLedgerEntries(1, customerId);
  
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

