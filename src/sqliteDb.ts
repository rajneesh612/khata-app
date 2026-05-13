import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

import type {
  AddBrandPayload,
  AddCategoryPayload,
  AddCustomerPayload,
  AddItemPayload,
  AddLedgerEntryPayload,
  AddShopPayload,
  AuditLog,
  Brand,
  Category,
  Customer,
  CustomerSummary,
  Item,
  ItemFilters,
  LedgerAging,
  LedgerEntry,
  Shop,
  UpdateCustomerPayload
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
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
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
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      brand_id INTEGER NOT NULL,
      default_rate REAL,
      unit TEXT,
      stock_quantity REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id)
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

  ensureColumn("customers", "shop_id", "INTEGER");
  ensureColumn("ledger_entries", "shop_id", "INTEGER");
  ensureColumn("categories", "shop_id", "INTEGER");
  ensureColumn("brands", "shop_id", "INTEGER");
  ensureColumn("items", "shop_id", "INTEGER");
  ensureColumn("audit_logs", "shop_id", "INTEGER");
  
  ensureColumn("ledger_entries", "item_id", "INTEGER");
  ensureColumn("ledger_entries", "unit", "TEXT");
  ensureColumn("ledger_entries", "affects_balance", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("items", "stock_quantity", "REAL NOT NULL DEFAULT 0");
  ensureColumn("customers", "address", "TEXT");
  ensureColumn("items", "low_stock_threshold", "REAL NOT NULL DEFAULT 5");
  
  // Ensure default shop exists for demo purposes
  const shopCount = (db.prepare("SELECT COUNT(*) as count FROM shops").get() as { count: number }).count;
  if (shopCount === 0) {
    db.prepare("INSERT INTO shops (id, shop_name, owner_name, email, password_hash) VALUES (?, ?, ?, ?, ?)")
      .run(1, "Demo Shop", "Admin", "admin@demo.com", "placeholder_hash");
  }

  return db;
};

export const initDb = (): void => {
  getDb();
};

// Auth methods
export const addShop = (payload: AddShopPayload): Shop => {
  const database = getDb();
  const info = database
    .prepare(
      "INSERT INTO shops (shop_name, owner_name, email, password_hash) VALUES (?, ?, ?, ?)"
    )
    .run(payload.shop_name, payload.owner_name, payload.email, payload.password_hash);

  return database.prepare("SELECT * FROM shops WHERE id = ?").get(info.lastInsertRowid) as Shop;
};

export const findShopByEmail = (email: string): Shop | undefined => {
  const database = getDb();
  return database.prepare("SELECT * FROM shops WHERE email = ?").get(email) as Shop | undefined;
};

const writeAuditLog = (payload: {
  shopId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
}): void => {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO audit_logs (shop_id, action, entity_type, entity_id, summary) VALUES (?, ?, ?, ?, ?)"
    )
    .run(payload.shopId, payload.action, payload.entityType, payload.entityId, payload.summary);
};

export const listCustomers = (shopId: number): Customer[] => {
  const database = getDb();
  return database
    .prepare("SELECT id, name, phone, address, created_at FROM customers WHERE shop_id = ? ORDER BY name ASC")
    .all(shopId) as Customer[];
};

export const addCustomer = (payload: AddCustomerPayload): Customer => {
  const database = getDb();
  const name = payload.name.trim();

  if (!name) {
    throw new Error("Customer name required");
  }

  const info = database
    .prepare("INSERT INTO customers (shop_id, name, phone, address) VALUES (?, ?, ?, ?)")
    .run(payload.shop_id, name, payload.phone?.trim() || null, payload.address?.trim() || null);

  const customer = database
    .prepare("SELECT id, name, phone, address, created_at FROM customers WHERE id = ?")
    .get(info.lastInsertRowid) as Customer;

  writeAuditLog({
    shopId: payload.shop_id,
    action: "create",
    entityType: "customer",
    entityId: customer.id,
    summary: `Customer created: ${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`
  });

  return customer;
};

export const updateCustomer = (payload: UpdateCustomerPayload): Customer => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Customer name required");
  }

  const info = database
    .prepare("UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ? AND shop_id = ?")
    .run(name, payload.phone?.trim() || null, payload.address?.trim() || null, payload.id, payload.shop_id);

  if (info.changes === 0) {
    throw new Error("Customer not found or access denied");
  }

  const customer = database
    .prepare("SELECT id, name, phone, address, created_at FROM customers WHERE id = ?")
    .get(payload.id) as Customer;

  writeAuditLog({
    shopId: payload.shop_id,
    action: "update",
    entityType: "customer",
    entityId: customer.id,
    summary: `Customer updated: ${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`
  });

  return customer;
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

  const rate = (payload.rate !== undefined && payload.rate !== null) ? Number(payload.rate) : 0;
  const amount = Number(payload.quantity) * rate;

  const entry = database.transaction(() => {
    const info = database
      .prepare(
        "INSERT INTO ledger_entries (shop_id, customer_id, item_id, item_name, quantity, rate, amount, unit, entry_type, affects_balance, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        payload.shop_id,
        payload.customerId,
        payload.itemId ?? null,
        itemName,
        payload.quantity,
        rate,
        amount,
        payload.unit ?? null,
        payload.entryType,
        payload.affectsBalance === false ? 0 : 1,
        payload.note?.trim() || null
      );

    return database
      .prepare("SELECT * FROM ledger_entries WHERE id = ?")
      .get(info.lastInsertRowid) as LedgerEntry;
  })();

  writeAuditLog({
    shopId: payload.shop_id,
    action: "create",
    entityType: "ledger_entry",
    entityId: entry.id,
    summary: `${entry.entry_type} entry for customer #${entry.customer_id}: ${entry.item_name} x ${entry.quantity} amount ${entry.amount.toFixed(2)}${entry.affects_balance === 0 ? " (cash)" : ""}`
  });

  return entry;
};

export const getLedgerEntries = (shopId: number, customerId: number): LedgerEntry[] => {
  const database = getDb();
  return database
    .prepare(
      "SELECT * FROM ledger_entries WHERE customer_id = ? AND shop_id = ? ORDER BY datetime(created_at) DESC"
    )
    .all(customerId, shopId) as LedgerEntry[];
};

export const listCategories = (shopId: number): Category[] => {
  const database = getDb();
  return database
    .prepare("SELECT id, name, created_at FROM categories WHERE shop_id = ? ORDER BY name")
    .all(shopId) as Category[];
};

export const addCategory = (payload: AddCategoryPayload): Category => {
  const database = getDb();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Category name required");
  }
  const info = database
    .prepare("INSERT INTO categories (shop_id, name) VALUES (?, ?)")
    .run(payload.shop_id, name);
    
  const category = database
    .prepare("SELECT id, name, created_at FROM categories WHERE id = ?")
    .get(info.lastInsertRowid) as Category;

  writeAuditLog({
    shopId: payload.shop_id,
    action: "create",
    entityType: "category",
    entityId: category.id,
    summary: `Category created: ${category.name}`
  });

  return category;
};

export const listBrands = (shopId: number, categoryId?: number | null): Brand[] => {
  const database = getDb();
  let sql = "SELECT * FROM brands WHERE shop_id = ?";
  const params: (string | number | null)[] = [shopId];
  if (categoryId) {
    sql += " AND category_id = ?";
    params.push(categoryId);
  }
  sql += " ORDER BY name ASC";
  return database.prepare(sql).all(...params) as Brand[];
};

export const addBrand = (payload: AddBrandPayload): Brand => {
  const database = getDb();
  const info = database
    .prepare("INSERT INTO brands (shop_id, name, category_id) VALUES (?, ?, ?)")
    .run(payload.shop_id, payload.name.trim(), payload.categoryId);
    
  return database.prepare("SELECT * FROM brands WHERE id = ?").get(info.lastInsertRowid) as Brand;
};

export const getAllItems = (filters: ItemFilters): Item[] => {
  const database = getDb();
  let sql = "SELECT * FROM items WHERE shop_id = ?";
  const params: (string | number | null)[] = [filters.shop_id];
  if (filters.categoryId) {
    sql += " AND category_id = ?";
    params.push(filters.categoryId);
  }
  if (filters.brandId) {
    sql += " AND brand_id = ?";
    params.push(filters.brandId);
  }
  sql += " ORDER BY name ASC";
  return database.prepare(sql).all(...params) as Item[];
};

export const addItem = (payload: AddItemPayload): Item => {
  const database = getDb();
  const info = database
    .prepare(
      "INSERT INTO items (shop_id, name, category_id, brand_id, default_rate, unit, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      payload.shop_id,
      payload.name.trim(),
      payload.categoryId,
      payload.brandId,
      payload.defaultRate ?? null,
      payload.unit ?? null,
      payload.stockQuantity ?? 0
    );
    
  return database.prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid) as Item;
};

export const deleteItem = (shopId: number, itemId: number): void => {
  const database = getDb();
  const item = database
    .prepare("SELECT * FROM items WHERE id = ? AND shop_id = ?")
    .get(itemId, shopId) as Item | undefined;

  if (!item) {
    throw new Error("Item not found or access denied");
  }

  database.prepare("DELETE FROM items WHERE id = ? AND shop_id = ?").run(itemId, shopId);

  writeAuditLog({
    shopId,
    action: "delete",
    entityType: "item",
    entityId: itemId,
    summary: `Item deleted: ${item.name}`
  });
};

export const deleteLedgerEntry = (shopId: number, entryId: number): void => {
  const database = getDb();
  const entry = database
    .prepare("SELECT * FROM ledger_entries WHERE id = ? AND shop_id = ?")
    .get(entryId, shopId) as LedgerEntry | undefined;

  if (!entry) {
    throw new Error("Entry not found or access denied");
  }

  database.prepare("DELETE FROM ledger_entries WHERE id = ? AND shop_id = ?").run(entryId, shopId);

  writeAuditLog({
    shopId,
    action: "delete",
    entityType: "ledger_entry",
    entityId: entryId,
    summary: `${entry.entry_type} entry for customer #${entry.customer_id} deleted: ${entry.item_name}`
  });
};

export const listAuditLogs = (shopId: number, limit = 50): AuditLog[] => {
  const database = getDb();
  return database
    .prepare("SELECT * FROM audit_logs WHERE shop_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(shopId, limit) as AuditLog[];
};

export const getCustomerSummary = (shopId: number, customerId: number): CustomerSummary => {
  const database = getDb();
  const result = database
    .prepare(
      `SELECT 
        SUM(CASE WHEN entry_type = 'debit' AND affects_balance = 1 THEN amount ELSE 0 END) as totalDebit,
        SUM(CASE WHEN entry_type = 'credit' AND affects_balance = 1 THEN amount ELSE 0 END) as totalCredit
      FROM ledger_entries WHERE customer_id = ? AND shop_id = ?`
    )
    .get(customerId, shopId) as { totalDebit: number | null; totalCredit: number | null };

  const debit = result.totalDebit || 0;
  const credit = result.totalCredit || 0;

  return {
    totalDebit: debit,
    totalCredit: credit,
    balance: debit - credit
  };
};

export const getLedgerAging = (shopId: number, customerId: number): LedgerAging => {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT 
          amount, 
          entry_type, 
          (julianday('now') - julianday(created_at)) as days_old 
        FROM ledger_entries 
        WHERE customer_id = ? AND shop_id = ? AND affects_balance = 1`
    )
    .all(customerId, shopId) as Array<{ amount: number; entry_type: string; days_old: number }>;

  const aging = { current: 0, days30: 0, days60: 0, days90: 0, older: 0 };
  let netBalance = 0;

  rows.forEach((row) => {
    const signedValue = row.entry_type === "credit" ? -row.amount : row.amount;
    netBalance += signedValue;
  });

  if (netBalance <= 0) return aging;

  let remaining = netBalance;
  rows
    .filter((r) => r.entry_type === "debit")
    .sort((a, b) => b.days_old - a.days_old)
    .forEach((row) => {
      if (remaining <= 0) return;
      const take = Math.min(remaining, row.amount);
      if (row.days_old > 90) aging.older += take;
      else if (row.days_old > 60) aging.days90 += take;
      else if (row.days_old > 30) aging.days60 += take;
      else if (row.days_old > 0) aging.days30 += take;
      else aging.current += take;
      remaining -= take;
    });

  return aging;
};
