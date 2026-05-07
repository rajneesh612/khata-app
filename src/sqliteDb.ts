import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  AddBrandPayload,
  AddCategoryPayload,
  AddCustomerPayload,
  AddItemPayload,
  AddLedgerEntryPayload,
  Brand,
  Category,
  Customer,
  CustomerSummary,
  Item,
  ItemFilters,
  LedgerAging,
  LedgerEntry
} from "./dbTypes";

let db: Database.Database | null = null;

const getDb = (): Database.Database => {
  if (db) {
    return db;
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "khata.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL,
      amount REAL NOT NULL,
      unit TEXT,
      entry_type TEXT NOT NULL,
      affects_balance INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (name, category_id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      brand_id INTEGER NOT NULL,
      default_rate REAL,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (name, brand_id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );
  `);

  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = db
      ?.prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (!cols?.some((col) => col.name === column)) {
      db?.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn("ledger_entries", "item_id", "INTEGER");
  ensureColumn("ledger_entries", "unit", "TEXT");
  ensureColumn("ledger_entries", "affects_balance", "INTEGER NOT NULL DEFAULT 1");

  seedCatalog(db);

  return db;
};

const seedCatalog = (database: Database.Database): void => {
  const categoryCount = database
    .prepare("SELECT COUNT(*) as count FROM categories")
    .get() as { count: number };
  if (categoryCount.count > 0) {
    return;
  }

  const categories = [
    "Grocery",
    "Dairy",
    "Biscuit",
    "Snacks",
    "Oil",
    "Soap",
    "Cold Drinks"
  ];

  const insertCategory = database.prepare(
    "INSERT INTO categories (name) VALUES (?)"
  );
  const insertBrand = database.prepare(
    "INSERT INTO brands (name, category_id) VALUES (?, ?)"
  );
  const insertItem = database.prepare(
    "INSERT INTO items (name, category_id, brand_id, default_rate, unit) VALUES (?, ?, ?, ?, ?)"
  );

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

  database.transaction(() => {
    categories.forEach((name) => {
      insertCategory.run(name);
    });

    const categoryMap = new Map<string, number>();
    (database.prepare("SELECT id, name FROM categories").all() as Array<Category>).forEach(
      (category) => categoryMap.set(category.name, category.id)
    );

    seedBrands.forEach((brand) => {
      const categoryId = categoryMap.get(brand.category);
      if (categoryId) {
        insertBrand.run(brand.name, categoryId);
      }
    });

    const brandMap = new Map<string, number>();
    (database.prepare("SELECT id, name FROM brands").all() as Array<Brand>).forEach(
      (brand) => brandMap.set(brand.name, brand.id)
    );

    seedItems.forEach((item) => {
      const categoryId = categoryMap.get(item.category);
      const brandId = brandMap.get(item.brand);
      if (categoryId && brandId) {
        insertItem.run(
          item.name,
          categoryId,
          brandId,
          item.defaultRate,
          item.unit
        );
      }
    });
  })();
};

export const initDb = (): void => {
  getDb();
};

export const listCustomers = (): Customer[] => {
  const database = getDb();
  const stmt = database.prepare(
    "SELECT id, name, phone, created_at FROM customers ORDER BY name"
  );
  return stmt.all() as Customer[];
};

export const addCustomer = (payload: AddCustomerPayload): Customer => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Customer name required");
  }

  const info = database
    .prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
    .run(name, payload.phone?.trim() || null);

  return database
    .prepare("SELECT id, name, phone, created_at FROM customers WHERE id = ?")
    .get(info.lastInsertRowid) as Customer;
};

export const addLedgerEntry = (payload: AddLedgerEntryPayload): LedgerEntry => {
  const database = getDb();
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

  const info = database
    .prepare(
      "INSERT INTO ledger_entries (customer_id, item_id, item_name, quantity, rate, amount, unit, entry_type, affects_balance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
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
    );

  return database
    .prepare("SELECT * FROM ledger_entries WHERE id = ?")
    .get(info.lastInsertRowid) as LedgerEntry;
};

export const getLedgerEntries = (customerId: number): LedgerEntry[] => {
  const database = getDb();
  return database
    .prepare(
      "SELECT * FROM ledger_entries WHERE customer_id = ? ORDER BY datetime(created_at) DESC"
    )
    .all(customerId) as LedgerEntry[];
};

export const listCategories = (): Category[] => {
  const database = getDb();
  return database
    .prepare("SELECT id, name, created_at FROM categories ORDER BY name")
    .all() as Category[];
};

export const addCategory = (payload: AddCategoryPayload): Category => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Category name required");
  }
  const info = database
    .prepare("INSERT INTO categories (name) VALUES (?)")
    .run(name);
  return database
    .prepare("SELECT id, name, created_at FROM categories WHERE id = ?")
    .get(info.lastInsertRowid) as Category;
};

export const listBrands = (categoryId?: number | null): Brand[] => {
  const database = getDb();
  if (categoryId) {
    return database
      .prepare(
        "SELECT id, name, category_id, created_at FROM brands WHERE category_id = ? ORDER BY name"
      )
      .all(categoryId) as Brand[];
  }
  return database
    .prepare("SELECT id, name, category_id, created_at FROM brands ORDER BY name")
    .all() as Brand[];
};

export const addBrand = (payload: AddBrandPayload): Brand => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Brand name required");
  }
  if (!payload.categoryId) {
    throw new Error("Category is required for brand");
  }
  const info = database
    .prepare("INSERT INTO brands (name, category_id) VALUES (?, ?)")
    .run(name, payload.categoryId);
  return database
    .prepare("SELECT id, name, category_id, created_at FROM brands WHERE id = ?")
    .get(info.lastInsertRowid) as Brand;
};

export const getAllItems = (filters?: ItemFilters): Item[] => {
  const database = getDb();
  if (filters?.brandId) {
    return database
      .prepare(
        "SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items WHERE brand_id = ? ORDER BY name"
      )
      .all(filters.brandId) as Item[];
  }
  if (filters?.categoryId) {
    return database
      .prepare(
        "SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items WHERE category_id = ? ORDER BY name"
      )
      .all(filters.categoryId) as Item[];
  }
  return database
    .prepare(
      "SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items ORDER BY name"
    )
    .all() as Item[];
};

export const addItem = (payload: AddItemPayload): Item => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Item name required");
  }
  if (!payload.categoryId || !payload.brandId) {
    throw new Error("Category and brand required");
  }

  if (payload.id) {
    database
      .prepare(
        "UPDATE items SET name = ?, category_id = ?, brand_id = ?, default_rate = ?, unit = ? WHERE id = ?"
      )
      .run(
        name,
        payload.categoryId,
        payload.brandId,
        payload.defaultRate ?? null,
        payload.unit ?? null,
        payload.id
      );
    return database
      .prepare(
        "SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items WHERE id = ?"
      )
      .get(payload.id) as Item;
  }

  const info = database
    .prepare(
      "INSERT INTO items (name, category_id, brand_id, default_rate, unit) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      name,
      payload.categoryId,
      payload.brandId,
      payload.defaultRate ?? null,
      payload.unit ?? null
    );

  return database
    .prepare(
      "SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items WHERE id = ?"
    )
    .get(info.lastInsertRowid) as Item;
};

export const deleteItem = (itemId: number): void => {
  const database = getDb();
  database.prepare("DELETE FROM items WHERE id = ?").run(itemId);
};

export const getCustomerSummary = (customerId: number): CustomerSummary => {
  const database = getDb();
  const row = database
    .prepare(
      `
      SELECT
        SUM(CASE WHEN entry_type = 'debit' AND COALESCE(affects_balance, 1) = 1 THEN amount ELSE 0 END) AS totalDebit,
        SUM(CASE WHEN entry_type = 'credit' AND COALESCE(affects_balance, 1) = 1 THEN amount ELSE 0 END) AS totalCredit
      FROM ledger_entries
      WHERE customer_id = ?
    `
    )
    .get(customerId) as {
    totalDebit: number | null;
    totalCredit: number | null;
  };

  const totalDebit = row?.totalDebit || 0;
  const totalCredit = row?.totalCredit || 0;
  return {
    balance: totalDebit - totalCredit,
    totalDebit,
    totalCredit
  };
};

export const getLedgerAging = (customerId: number): LedgerAging => {
  const database = getDb();
  const entries = database
    .prepare(
      "SELECT amount, entry_type, created_at, affects_balance FROM ledger_entries WHERE customer_id = ? AND COALESCE(affects_balance, 1) = 1"
    )
    .all(customerId) as Array<{
    amount: number;
    entry_type: "debit" | "credit";
    created_at: string;
    affects_balance: number;
  }>;

  const now = Date.now();
  const buckets: LedgerAging = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    older: 0
  };

  for (const entry of entries) {
    const created = Date.parse(entry.created_at + "Z");
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