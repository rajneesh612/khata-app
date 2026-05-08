import cors from "cors";
import express from "express";
import path from "path";
import {
  addCustomer,
  addCategory,
  addBrand,
  addItem,
  addLedgerEntry,
  deleteItem,
  getAllItems,
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
  process.env.CLIENT_URL
].filter(Boolean) as string[];

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    }
  })
);

if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.redirect("http://localhost:5173");
  });
}

app.get("/api/customers", async (_req, res) => {
  res.json(await listCustomers());
});

app.post("/api/customers", async (req, res) => {
  try {
    const customer = await addCustomer({
  name: String(req.body?.name || ""),
  phone: req.body?.phone ? String(req.body.phone) : undefined,
  address: req.body?.address ? String(req.body.address) : undefined
});
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  try {
    const customer = await updateCustomer({
  id: customerId,
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
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(await getLedgerEntries(customerId));
});

app.post("/api/customers/:id/entries", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  try {
    const entry = await addLedgerEntry({
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

app.get("/api/customers/:id/summary", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(await getCustomerSummary(customerId));
});

app.get("/api/customers/:id/aging", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(await getLedgerAging(customerId));
});

app.get("/api/categories", async (_req, res) => {
  res.json(await listCategories());
});

app.post("/api/categories", async (req, res) => {
  try {
    const category = await addCategory({
      name: String(req.body?.name || "")
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/brands", async (req, res) => {
  const categoryId = req.query.categoryId
    ? Number(req.query.categoryId)
    : null;
  if (req.query.categoryId && !Number.isFinite(categoryId)) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }
  res.json(await listBrands(categoryId));
});

app.post("/api/brands", async (req, res) => {
  try {
    const brand = await addBrand({
      name: String(req.body?.name || ""),
      categoryId: req.body?.categoryId ? Number(req.body.categoryId) : null
    });
    res.status(201).json(brand);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/items", async (req, res) => {
  const categoryId = req.query.categoryId
    ? Number(req.query.categoryId)
    : null;
  const brandId = req.query.brandId ? Number(req.query.brandId) : null;
  if (req.query.categoryId && !Number.isFinite(categoryId)) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }
  if (req.query.brandId && !Number.isFinite(brandId)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }
  res.json(await getAllItems({ categoryId, brandId }));
});

app.post("/api/items", async (req, res) => {
  try {
    const item = await addItem({
      name: String(req.body?.name || ""),
      categoryId: Number(req.body?.categoryId || 0),
      brandId: Number(req.body?.brandId || 0),
      defaultRate: req.body?.defaultRate
        ? Number(req.body.defaultRate)
        : null,
      unit: req.body?.unit ? String(req.body.unit) : null,
      stockQuantity:
        req.body?.stockQuantity !== undefined ? Number(req.body.stockQuantity) : null,
      lowStockThreshold:
        req.body?.lowStockThreshold !== undefined
          ? Number(req.body.lowStockThreshold)
          : null
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/items/:id", async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  try {
    const item = await addItem({
      id: itemId,
      name: String(req.body?.name || ""),
      categoryId: Number(req.body?.categoryId || 0),
      brandId: Number(req.body?.brandId || 0),
      defaultRate: req.body?.defaultRate
        ? Number(req.body.defaultRate)
        : null,
      unit: req.body?.unit ? String(req.body.unit) : null,
      stockQuantity:
        req.body?.stockQuantity !== undefined ? Number(req.body.stockQuantity) : null,
      lowStockThreshold:
        req.body?.lowStockThreshold !== undefined
          ? Number(req.body.lowStockThreshold)
          : null
    });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/items/:id", async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  await deleteItem(itemId);
  res.status(204).send();
});

app.delete("/api/customers/:customerId/entries/:entryId", async (req, res) => {
  const entryId = Number(req.params.entryId);
  if (!Number.isFinite(entryId)) {
    res.status(400).json({ error: "Invalid entry id" });
    return;
  }
  await deleteLedgerEntry(entryId);
  res.status(204).send();
});

app.get("/api/audit-logs", async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  if (!Number.isFinite(limit) || limit <= 0) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }

  res.json(await listAuditLogs(Math.min(limit, 200)));
});

app.get("/api/export/customers.csv", async (_req, res) => {
  const customers = await listCustomers();
  const rows: Array<Array<string | number>> = [
    ["Customer Id", "Name", "Phone", "Total Debit", "Total Credit", "Balance"]
  ];

  for (const customer of customers) {
    const summary = await getCustomerSummary(customer.id);
    rows.push([
      customer.id,
      customer.name,
      customer.phone || "",
      summary.totalDebit,
      summary.totalCredit,
      summary.balance
    ]);
  }

  const csv = rows
    .map((row) => row.map((cell) => toCsvValue(cell)).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=customers-summary.csv"
  );
  res.send(csv);
});

app.get("/api/export/customers/:id/ledger.csv", async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  const customers = await listCustomers();
  const customer = customers.find((item) => item.id === customerId);
  const entries = await getLedgerEntries(customerId);
  const rows: Array<Array<string | number>> = [
    [
      "Customer Id",
      "Customer Name",
      "Date",
      "Type",
      "Item",
      "Qty",
      "Rate",
      "Amount",
      "Note"
    ]
  ];

  entries.forEach((entry) => {
    rows.push([
      customerId,
      customer?.name || "",
      entry.created_at,
      entry.entry_type,
      entry.item_name,
      entry.quantity,
      entry.rate ?? "",
      entry.amount,
      entry.note || ""
    ]);
  });

  const csv = rows
    .map((row) => row.map((cell) => toCsvValue(cell)).join(","))
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=customer-${customerId}-ledger.csv`
  );
  res.send(csv);
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Khata web app running on http://localhost:${port}`);
      if (process.env.DATABASE_URL) {
        console.log("Database mode: Postgres");
      } else {
        console.log("Database mode: SQLite");
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
