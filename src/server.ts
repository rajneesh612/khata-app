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
  listBrands,
  listCategories,
  listCustomers
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

app.get("/api/customers", (_req, res) => {
  res.json(listCustomers());
});

app.post("/api/customers", (req, res) => {
  try {
    const customer = addCustomer({
      name: String(req.body?.name || ""),
      phone: req.body?.phone ? String(req.body.phone) : undefined
    });
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/customers/:id/entries", (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(getLedgerEntries(customerId));
});

app.post("/api/customers/:id/entries", (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  try {
    const entry = addLedgerEntry({
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

app.get("/api/customers/:id/summary", (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(getCustomerSummary(customerId));
});

app.get("/api/customers/:id/aging", (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  res.json(getLedgerAging(customerId));
});

app.get("/api/categories", (_req, res) => {
  res.json(listCategories());
});

app.post("/api/categories", (req, res) => {
  try {
    const category = addCategory({
      name: String(req.body?.name || "")
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/brands", (req, res) => {
  const categoryId = req.query.categoryId
    ? Number(req.query.categoryId)
    : null;
  if (req.query.categoryId && !Number.isFinite(categoryId)) {
    res.status(400).json({ error: "Invalid category id" });
    return;
  }
  res.json(listBrands(categoryId));
});

app.post("/api/brands", (req, res) => {
  try {
    const brand = addBrand({
      name: String(req.body?.name || ""),
      categoryId: req.body?.categoryId ? Number(req.body.categoryId) : null
    });
    res.status(201).json(brand);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/items", (req, res) => {
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
  res.json(getAllItems({ categoryId, brandId }));
});

app.post("/api/items", (req, res) => {
  try {
    const item = addItem({
      name: String(req.body?.name || ""),
      categoryId: Number(req.body?.categoryId || 0),
      brandId: Number(req.body?.brandId || 0),
      defaultRate: req.body?.defaultRate
        ? Number(req.body.defaultRate)
        : null,
      unit: req.body?.unit ? String(req.body.unit) : null
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/items/:id", (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  try {
    const item = addItem({
      id: itemId,
      name: String(req.body?.name || ""),
      categoryId: Number(req.body?.categoryId || 0),
      brandId: Number(req.body?.brandId || 0),
      defaultRate: req.body?.defaultRate
        ? Number(req.body.defaultRate)
        : null,
      unit: req.body?.unit ? String(req.body.unit) : null
    });
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/items/:id", (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isFinite(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  deleteItem(itemId);
  res.status(204).send();
});

app.get("/api/export/customers.csv", (_req, res) => {
  const customers = listCustomers();
  const rows: Array<Array<string | number>> = [
    ["Customer Id", "Name", "Phone", "Total Debit", "Total Credit", "Balance"]
  ];

  customers.forEach((customer) => {
    const summary = getCustomerSummary(customer.id);
    rows.push([
      customer.id,
      customer.name,
      customer.phone || "",
      summary.totalDebit,
      summary.totalCredit,
      summary.balance
    ]);
  });

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

app.get("/api/export/customers/:id/ledger.csv", (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isFinite(customerId)) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  const customers = listCustomers();
  const customer = customers.find((item) => item.id === customerId);
  const entries = getLedgerEntries(customerId);
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

app.listen(port, () => {
  console.log(`Khata web app running on http://localhost:${port}`);
});
