const path = require('path')
const Database = require('better-sqlite3')
const { Pool } = require('pg')

const sqlitePath = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'khata.db')
const databaseUrl = process.env.DATABASE_URL

const createPool = () => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.PGSSL === 'false'
        ? false
        : process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
  })
}

const ensureSchema = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (name, category_id)
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
      default_rate DOUBLE PRECISION,
      unit TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (name, brand_id)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id SERIAL PRIMARY KEY,
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
  `)
}

const syncSequence = async (pool, tableName) => {
  await pool.query(
    `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1), true)`,
    [tableName]
  )
}

const migrate = async () => {
  const sqlite = new Database(sqlitePath, { readonly: true })
  const pool = createPool()

  try {
    await ensureSchema(pool)
    await pool.query('BEGIN')

    const categories = sqlite.prepare('SELECT id, name, created_at FROM categories ORDER BY id').all()
    for (const row of categories) {
      await pool.query(
        `
          INSERT INTO categories (id, name, created_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              created_at = EXCLUDED.created_at
        `,
        [row.id, row.name, row.created_at]
      )
    }

    const brands = sqlite.prepare('SELECT id, name, category_id, created_at FROM brands ORDER BY id').all()
    for (const row of brands) {
      await pool.query(
        `
          INSERT INTO brands (id, name, category_id, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              category_id = EXCLUDED.category_id,
              created_at = EXCLUDED.created_at
        `,
        [row.id, row.name, row.category_id, row.created_at]
      )
    }

    const items = sqlite
      .prepare(
        'SELECT id, name, category_id, brand_id, default_rate, unit, created_at FROM items ORDER BY id'
      )
      .all()
    for (const row of items) {
      await pool.query(
        `
          INSERT INTO items (id, name, category_id, brand_id, default_rate, unit, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              category_id = EXCLUDED.category_id,
              brand_id = EXCLUDED.brand_id,
              default_rate = EXCLUDED.default_rate,
              unit = EXCLUDED.unit,
              created_at = EXCLUDED.created_at
        `,
        [
          row.id,
          row.name,
          row.category_id,
          row.brand_id,
          row.default_rate,
          row.unit,
          row.created_at,
        ]
      )
    }

    const customers = sqlite
      .prepare('SELECT id, name, phone, created_at FROM customers ORDER BY id')
      .all()
    for (const row of customers) {
      await pool.query(
        `
          INSERT INTO customers (id, name, phone, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              created_at = EXCLUDED.created_at
        `,
        [row.id, row.name, row.phone, row.created_at]
      )
    }

    const entries = sqlite
      .prepare(
        'SELECT id, customer_id, item_id, item_name, quantity, rate, amount, unit, entry_type, affects_balance, note, created_at FROM ledger_entries ORDER BY id'
      )
      .all()
    for (const row of entries) {
      await pool.query(
        `
          INSERT INTO ledger_entries (
            id,
            customer_id,
            item_id,
            item_name,
            quantity,
            rate,
            amount,
            unit,
            entry_type,
            affects_balance,
            note,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE
          SET customer_id = EXCLUDED.customer_id,
              item_id = EXCLUDED.item_id,
              item_name = EXCLUDED.item_name,
              quantity = EXCLUDED.quantity,
              rate = EXCLUDED.rate,
              amount = EXCLUDED.amount,
              unit = EXCLUDED.unit,
              entry_type = EXCLUDED.entry_type,
              affects_balance = EXCLUDED.affects_balance,
              note = EXCLUDED.note,
              created_at = EXCLUDED.created_at
        `,
        [
          row.id,
          row.customer_id,
          row.item_id,
          row.item_name,
          row.quantity,
          row.rate,
          row.amount,
          row.unit,
          row.entry_type,
          row.affects_balance,
          row.note,
          row.created_at,
        ]
      )
    }

    await syncSequence(pool, 'categories')
    await syncSequence(pool, 'brands')
    await syncSequence(pool, 'items')
    await syncSequence(pool, 'customers')
    await syncSequence(pool, 'ledger_entries')

    await pool.query('COMMIT')
    console.log('SQLite to Postgres migration completed successfully')
  } catch (error) {
    await pool.query('ROLLBACK')
    throw error
  } finally {
    sqlite.close()
    await pool.end()
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = { migrate }