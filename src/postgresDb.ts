import { Pool } from "pg";
import type {
  AddBrandPayload,
  AddCategoryPayload,
  AddCustomerPayload,
  AddItemPayload,
  AddLedgerEntryPayload,
  AuditLog,
  Brand,
  Category,
  Customer,
  CustomerSummary,
  Item,
  ItemFilters,
  LedgerAging,
  LedgerEntry,
  UpdateCustomerPayload
} from "./dbTypes";

const seedCategories = [
  "Grocery",
  "Dairy",
  "Biscuit",
  "Snacks",
  "Oil",
  "Soap",
  "Cold Drinks"
];

const seedBrands = [
  { name: "Parle", category: "Biscuit" },
  { name: "Britannia", category: "Biscuit" },
  { name: "Fortune", category: "Oil" },
  { name: "Amul", category: "Dairy" },
  { name: "Lux", category: "Soap" },
  { name: "Pepsi", category: "Cold Drinks" },
  { name: "Coca Cola", category: "Cold Drinks" },
  { name: "Generic", category: "Grocery" },
  { name: "Haldiram", category: "Snacks" }
];

const seedItems = [
  {
    name: "Parle-G",
    category: "Biscuit",
    brand: "Parle",
    defaultRate: 10,
    unit: "packet"
  },
  {
    name: "Marie Gold",
    category: "Biscuit",
    brand: "Britannia",
    defaultRate: 15,
    unit: "packet"
  },
  {
    name: "Aashirvaad Atta",
    category: "Grocery",
    brand: "Generic",
    defaultRate: 280,
    unit: "5kg"
  },
  {
    name: "Sugar",
    category: "Grocery",
    brand: "Generic",
    defaultRate: 45,
    unit: "kg"
  },
  {
    name: "Amul Milk",
    category: "Dairy",
    brand: "Amul",
    defaultRate: 28,
    unit: "500ml"
  },
  {
    name: "Amul Butter",
    category: "Dairy",
    brand: "Amul",
    defaultRate: 55,
    unit: "100g"
  },
  {
    name: "Fortune Mustard Oil",
    category: "Oil",
    brand: "Fortune",
    defaultRate: 160,
    unit: "1L"
  },
  {
    name: "Lays Classic",
    category: "Snacks",
    brand: "Haldiram",
    defaultRate: 20,
    unit: "packet"
  },
  {
    name: "Lux Soap",
    category: "Soap",
    brand: "Lux",
    defaultRate: 30,
    unit: "bar"
  },
  {
    name: "Pepsi",
    category: "Cold Drinks",
    brand: "Pepsi",
    defaultRate: 20,
    unit: "250ml"
  },
  {
    name: "Coca Cola",
    category: "Cold Drinks",
    brand: "Coca Cola",
    defaultRate: 20,
    unit: "250ml"
  }
];

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

const getPool = (): Pool => {
  if (pool) {
    return pool;
  }
  

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for Postgres mode");
  }

  pool = new Pool({
    connectionString,
    ssl:
      process.env.PGSSL === "false"
        ? false
        : process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined
  });

  return pool;
};

const mapTimestamp = (value: Date | string): string => {
  return value instanceof Date ? value.toISOString() : String(value);
};

const mapCustomer = (row: {
  id: number;
  shop_id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: Date | string;
}): Customer => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const mapCategory = (row: {
  id: number;
  shop_id: number;
  name: string;
  created_at: Date | string;
}): Category => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const mapBrand = (row: {
  id: number;
  shop_id: number;
  name: string;
  category_id: number;
  created_at: Date | string;
}): Brand => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const mapItem = (row: {
  id: number;
  shop_id: number;
  name: string;
  category_id: number;
  brand_id: number;
  default_rate: number | null;
  unit: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: Date | string;
}): Item => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const mapLedgerEntry = (row: {
  id: number;
  shop_id: number;
  customer_id: number;
  item_id: number | null;
  item_name: string;
  quantity: number;
  rate: number | null;
  amount: number;
  unit: string | null;
  entry_type: "debit" | "credit";
  affects_balance: number;
  note: string | null;
  created_at: Date | string;
}): LedgerEntry => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const mapAuditLog = (row: {
  id: number;
  shop_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  created_at: Date | string;
}): AuditLog => ({
  ...row,
  created_at: mapTimestamp(row.created_at)
});

const writeAuditLog = async (payload: {
  shopId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
}): Promise<void> => {
  await getPool().query(
    "INSERT INTO audit_logs (shop_id, action, entity_type, entity_id, summary) VALUES ($1, $2, $3, $4, $5)",
    [payload.shopId, payload.action, payload.entityType, payload.entityId ?? null, payload.summary]
  );
};

const seedCatalog = async (): Promise<void> => {
  const database = getPool();
  const countResult = await database.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM categories"
  );

  if (Number(countResult.rows[0]?.count || 0) > 0) {
    return;
  }

  for (const name of seedCategories) {
    await database.query(
      "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [name]
    );
  }

  const categoryRows = await database.query<{ id: number; name: string }>(
    "SELECT id, name FROM categories"
  );
  const categoryMap = new Map(categoryRows.rows.map((row) => [row.name, row.id]));

  for (const brand of seedBrands) {
    const categoryId = categoryMap.get(brand.category);
    if (!categoryId) {
      continue;
    }
    await database.query(
      "INSERT INTO brands (name, category_id) VALUES ($1, $2) ON CONFLICT (name, category_id) DO NOTHING",
      [brand.name, categoryId]
    );
  }

  const brandRows = await database.query<{ id: number; name: string }>(
    "SELECT id, name FROM brands"
  );
  const brandMap = new Map(brandRows.rows.map((row) => [row.name, row.id]));

  for (const item of seedItems) {
    const categoryId = categoryMap.get(item.category);
    const brandId = brandMap.get(item.brand);
    if (!categoryId || !brandId) {
      continue;
    }
    await database.query(
      "INSERT INTO items (name, category_id, brand_id, default_rate, unit, stock_quantity, low_stock_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (name, brand_id) DO NOTHING",
      [item.name, categoryId, brandId, item.defaultRate, item.unit, 0, 5]
    );
  }
};

export const initDb = async (): Promise<void> => {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const database = getPool();

    await database.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        shop_name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (name, category_id)
      );

      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
        default_rate DOUBLE PRECISION,
        unit TEXT,
        stock_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
        low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 5,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (name, brand_id)
      );

      CREATE TABLE IF NOT EXISTS ledger_entries (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        item_name TEXT NOT NULL,
        quantity DOUBLE PRECISION NOT NULL,
        rate DOUBLE PRECISION,
        amount DOUBLE PRECISION NOT NULL,
        unit TEXT,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
        affects_balance INTEGER NOT NULL DEFAULT 1,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        summary TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure default shop exists
    const shopCount = await database.query("SELECT COUNT(*) FROM shops");
    if (parseInt(shopCount.rows[0].count) === 0) {
      await database.query(
        "INSERT INTO shops (id, shop_name, owner_name, email, password_hash) VALUES (1, 'Demo Shop', 'Admin', 'admin@demo.com', 'placeholder_hash')"
      );
    }

    await seedCatalog();
  })();

  return initPromise;
};

// Auth methods
export const addShop = async (payload: {
  shop_name: string;
  owner_name: string;
  email: string;
  password_hash: string;
}): Promise<Shop> => {
  await initDb();
  const result = await getPool().query(
    "INSERT INTO shops (shop_name, owner_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING *",
    [payload.shop_name, payload.owner_name, payload.email, payload.password_hash]
  );
  return result.rows[0] as Shop;
};

export const findShopByEmail = async (email: string): Promise<Shop | undefined> => {
  await initDb();
  const result = await getPool().query("SELECT * FROM shops WHERE email = $1", [email]);
  return result.rows[0] as Shop | undefined;
};

export const listCustomers = async (shopId: number): Promise<Customer[]> => {
  await initDb();
  const result = await getPool().query(
    "SELECT id, name, phone, address, created_at FROM customers WHERE shop_id = $1 ORDER BY name",
    [shopId]
  );
  return result.rows.map((row) => mapCustomer(row as Customer & { created_at: Date | string }));
};

export const addCustomer = async (payload: AddCustomerPayload): Promise<Customer> => {
  await initDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Customer name required");
  }

  const result = await getPool().query(
    "INSERT INTO customers (shop_id, name, phone, address) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, address, created_at",
    [payload.shop_id, name, payload.phone?.trim() || null, payload.address?.trim() || null]
  );

  const customer = mapCustomer(result.rows[0] as Customer & { created_at: Date | string });
  await writeAuditLog({
    shopId: payload.shop_id,
    action: "create",
    entityType: "customer",
    entityId: customer.id,
    summary: `Customer created: ${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`
  });
  return customer;
};

export const updateCustomer = async (
  payload: UpdateCustomerPayload
): Promise<Customer> => {
  await initDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Customer name required");
  }

  const result = await getPool().query(
    "UPDATE customers SET name = $1, phone = $2, address = $3 WHERE id = $4 AND shop_id = $5 RETURNING id, name, phone, address, created_at",
    [name, payload.phone?.trim() || null, payload.address?.trim() || null, payload.id, payload.shop_id]
  );

  if (!result.rows[0]) {
    throw new Error("Customer not found");
  }

  const customer = mapCustomer(result.rows[0] as Customer & { created_at: Date | string });
  await writeAuditLog({
    shopId: payload.shop_id,
    action: "update",
    entityType: "customer",
    entityId: customer.id,
    summary: `Customer updated: ${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`
  });
  return customer;
};

export const addLedgerEntry = async (
  payload: AddLedgerEntryPayload
): Promise<LedgerEntry> => {
  await initDb();
  const itemName = payload.itemName.trim();
  if (!itemName) {
    throw new Error("Item name required");
  }
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    throw new Error("Quantity must be positive");
  }

  const normalizedRate =
    payload.rate !== undefined && payload.rate !== null && payload.rate !== 0
      ? payload.rate
      : null;
  const amount = normalizedRate
    ? Number(payload.quantity) * Number(normalizedRate)
    : Number(payload.quantity);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    if (payload.entryType === "debit" && payload.itemId) {
      const itemResult = await client.query<{ id: number; stock_quantity: number }>(
        "SELECT id, stock_quantity FROM items WHERE id = $1 FOR UPDATE",
        [payload.itemId]
      );

      const item = itemResult.rows[0];
      if (!item) {
        throw new Error("Selected item not found");
      }
      if (Number(item.stock_quantity) <= 0) {
        throw new Error("Is item ka stock khatam ho gaya hai. Order create nahi ho sakta.");
      }
      if (Number(payload.quantity) > Number(item.stock_quantity)) {
        throw new Error(
          `Sirf ${Number(item.stock_quantity)} unit stock me hai. Itni quantity ka order create nahi ho sakta.`
        );
      }

      await client.query(
        "UPDATE items SET stock_quantity = stock_quantity - $1 WHERE id = $2",
        [payload.quantity, payload.itemId]
      );
    }

    const result = await client.query(
      `
        INSERT INTO ledger_entries (
          shop_id,
          customer_id,
          item_id,
          item_name,
          quantity,
          rate,
          amount,
          unit,
          entry_type,
          affects_balance,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        payload.shop_id,
        payload.customerId,
        payload.itemId ?? null,
        itemName,
        payload.quantity,
        normalizedRate,
        amount,
        payload.unit ?? null,
        payload.entryType,
        payload.affectsBalance === false ? 0 : 1,
        payload.note?.trim() || null
      ]
    );

    await client.query("COMMIT");

    const entry = mapLedgerEntry(
      result.rows[0] as LedgerEntry & { created_at: Date | string }
    );
  await writeAuditLog({
    shopId: payload.shop_id,
    action: "create",
    entityType: "ledger_entry",
    entityId: entry.id,
    summary: `${entry.entry_type} entry for customer #${entry.customer_id}: ${entry.item_name} x ${entry.quantity} amount ${entry.amount.toFixed(2)}${entry.affects_balance === 0 ? " (cash)" : ""}`
  });
    return entry;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getLedgerEntries = async (shopId: number, customerId: number): Promise<LedgerEntry[]> => {
  await initDb();
  const result = await getPool().query(
    "SELECT * FROM ledger_entries WHERE customer_id = $1 AND shop_id = $2 ORDER BY created_at DESC",
    [customerId, shopId]
  );
  return result.rows.map((row) =>
    mapLedgerEntry(row as LedgerEntry & { created_at: Date | string })
  );
};

export const listCategories = async (): Promise<Category[]> => {
  await initDb();
  const result = await getPool().query(
    "SELECT id, name, created_at FROM categories ORDER BY name"
  );
  return result.rows.map((row) => mapCategory(row as Category & { created_at: Date | string }));
};

export const addCategory = async (payload: AddCategoryPayload): Promise<Category> => {
  await initDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Category name required");
  }

  const result = await getPool().query(
    "INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at",
    [name]
  );
  const category = mapCategory(result.rows[0] as Category & { created_at: Date | string });
  await writeAuditLog({
    action: "create",
    entityType: "category",
    entityId: category.id,
    summary: `Category created: ${category.name}`
  });
  return category;
};

export const listBrands = async (categoryId?: number | null): Promise<Brand[]> => {
  await initDb();
  const result = categoryId
    ? await getPool().query(
        "SELECT id, name, category_id, created_at FROM brands WHERE category_id = $1 ORDER BY name",
        [categoryId]
      )
    : await getPool().query(
        "SELECT id, name, category_id, created_at FROM brands ORDER BY name"
      );

  return result.rows.map((row) => mapBrand(row as Brand & { created_at: Date | string }));
};

export const addBrand = async (payload: AddBrandPayload): Promise<Brand> => {
  await initDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Brand name required");
  }
  if (!payload.categoryId) {
    throw new Error("Category is required for brand");
  }

  const result = await getPool().query(
    "INSERT INTO brands (name, category_id) VALUES ($1, $2) RETURNING id, name, category_id, created_at",
    [name, payload.categoryId]
  );
  const brand = mapBrand(result.rows[0] as Brand & { created_at: Date | string });
  await writeAuditLog({
    action: "create",
    entityType: "brand",
    entityId: brand.id,
    summary: `Brand created: ${brand.name} in category #${brand.category_id}`
  });
  return brand;
};

export const getAllItems = async (filters?: ItemFilters): Promise<Item[]> => {
  await initDb();
  let query =
    "SELECT id, name, category_id, brand_id, default_rate, unit, stock_quantity, low_stock_threshold, created_at FROM items";
  const params: Array<number> = [];

  if (filters?.brandId) {
    query += " WHERE brand_id = $1";
    params.push(filters.brandId);
  } else if (filters?.categoryId) {
    query += " WHERE category_id = $1";
    params.push(filters.categoryId);
  }

  query += " ORDER BY name";

  const result = await getPool().query(query, params);
  return result.rows.map((row) => mapItem(row as Item & { created_at: Date | string }));
};

export const addItem = async (payload: AddItemPayload): Promise<Item> => {
  await initDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Item name required");
  }
  if (!payload.categoryId || !payload.brandId) {
    throw new Error("Category and brand required");
  }

  if (payload.id) {
    const result = await getPool().query(
      `
        UPDATE items
        SET name = $1, category_id = $2, brand_id = $3, default_rate = $4, unit = $5, stock_quantity = $6, low_stock_threshold = $7
        WHERE id = $8
        RETURNING id, name, category_id, brand_id, default_rate, unit, stock_quantity, low_stock_threshold, created_at
      `,
      [
        name,
        payload.categoryId,
        payload.brandId,
        payload.defaultRate ?? null,
        payload.unit ?? null,
        payload.stockQuantity ?? 0,
        payload.lowStockThreshold ?? 5,
        payload.id
      ]
    );

    if (!result.rows[0]) {
      throw new Error("Item not found");
    }

    const item = mapItem(result.rows[0] as Item & { created_at: Date | string });
    await writeAuditLog({
      action: "update",
      entityType: "item",
      entityId: item.id,
      summary: `Item updated: ${item.name} rate ${item.default_rate ?? "-"} unit ${item.unit ?? "-"}`
    });
    return item;
  }

  const result = await getPool().query(
    `
      INSERT INTO items (name, category_id, brand_id, default_rate, unit, stock_quantity, low_stock_threshold)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, category_id, brand_id, default_rate, unit, stock_quantity, low_stock_threshold, created_at
    `,
    [
      name,
      payload.categoryId,
      payload.brandId,
      payload.defaultRate ?? null,
      payload.unit ?? null,
      payload.stockQuantity ?? 0,
      payload.lowStockThreshold ?? 5
    ]
  );

  const item = mapItem(result.rows[0] as Item & { created_at: Date | string });
  await writeAuditLog({
    action: "create",
    entityType: "item",
    entityId: item.id,
    summary: `Item created: ${item.name} rate ${item.default_rate ?? "-"} unit ${item.unit ?? "-"}`
  });
  return item;
};

export const deleteItem = async (itemId: number): Promise<void> => {
  await initDb();
  const existing = await getPool().query<{ id: number; name: string }>(
    "SELECT id, name FROM items WHERE id = $1",
    [itemId]
  );
  await getPool().query("DELETE FROM items WHERE id = $1", [itemId]);
  const item = existing.rows[0];
  if (item) {
    await writeAuditLog({
      action: "delete",
      entityType: "item",
      entityId: item.id,
      summary: `Item deleted: ${item.name}`
    });
  }
};

export const deleteLedgerEntry = async (entryId: number): Promise<void> => {
  await initDb();
  const existing = await getPool().query<{ id: number; item_name: string }>(
    "SELECT id, item_name FROM ledger_entries WHERE id = $1",
    [entryId]
  );
  await getPool().query("DELETE FROM ledger_entries WHERE id = $1", [entryId]);
  const entry = existing.rows[0];
  if (entry) {
    await writeAuditLog({
      action: "delete",
      entityType: "ledger_entry",
      entityId: entry.id,
      summary: `Ledger entry deleted: ${entry.item_name}`
    });
  }
};

export const listAuditLogs = async (shopId: number, limit = 50): Promise<AuditLog[]> => {
  await initDb();
  const result = await getPool().query(
    "SELECT id, action, entity_type, entity_id, summary, created_at FROM audit_logs WHERE shop_id = $1 ORDER BY created_at DESC LIMIT $2",
    [shopId, limit]
  );
  return result.rows.map((row) => mapAuditLog(row as AuditLog & { created_at: Date | string }));
};

export const getCustomerSummary = async (
  shopId: number,
  customerId: number
): Promise<CustomerSummary> => {
  await initDb();
  const result = await getPool().query<{
    totaldebit: number | null;
    totalcredit: number | null;
  }>(
    `
      SELECT
        SUM(CASE WHEN entry_type = 'debit' AND COALESCE(affects_balance, 1) = 1 THEN amount ELSE 0 END) AS totalDebit,
        SUM(CASE WHEN entry_type = 'credit' AND COALESCE(affects_balance, 1) = 1 THEN amount ELSE 0 END) AS totalCredit
      FROM ledger_entries
      WHERE customer_id = $1 AND shop_id = $2
    `,
    [customerId, shopId]
  );

  const row = result.rows[0];
  const totalDebit = Number(row?.totaldebit || 0);
  const totalCredit = Number(row?.totalcredit || 0);
  return {
    balance: totalDebit - totalCredit,
    totalDebit,
    totalCredit
  };
};

export const getLedgerAging = async (shopId: number, customerId: number): Promise<LedgerAging> => {
  await initDb();
  const result = await getPool().query<{
    amount: number;
    entry_type: "debit" | "credit";
    created_at: Date | string;
  }>(
    `
      SELECT amount, entry_type, created_at
      FROM ledger_entries
      WHERE customer_id = $1 AND shop_id = $2 AND COALESCE(affects_balance, 1) = 1
    `,
    [customerId, shopId]
  );

  const now = Date.now();
  const buckets: LedgerAging = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    older: 0
  };

  for (const entry of result.rows) {
    const created = Date.parse(mapTimestamp(entry.created_at));
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const amount = entry.entry_type === "debit" ? entry.amount : -entry.amount;

    if (days <= 0) {
      buckets.current += amount;
    } else if (days <= 30) {
      buckets.days30 += amount;
    } else if (days <= 60) {
      buckets.days60 += amount;
    } else if (days <= 90) {
      buckets.days90 += amount;
    } else {
      buckets.older += amount;
    }
  }

  return buckets;
};