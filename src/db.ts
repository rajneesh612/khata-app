import * as sqliteDb from "./sqliteDb";
import * as postgresDb from "./postgresDb";

export type {
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

// Check if we should use Postgres or SQLite
const usePostgres = !!process.env.DATABASE_URL;
const db = usePostgres ? postgresDb : sqliteDb;

export const initDb = async (): Promise<void> => {
  await db.initDb();
};

export const addShop = async (...args: Parameters<typeof db.addShop>) => {
  return (db.addShop as any)(...args);
};

export const findShopByEmail = async (...args: Parameters<typeof db.findShopByEmail>) => {
  return (db.findShopByEmail as any)(...args);
};

export const listCustomers = async (...args: Parameters<typeof db.listCustomers>) => {
  return (db.listCustomers as any)(...args);
};

export const addCustomer = async (...args: Parameters<typeof db.addCustomer>) => {
  return (db.addCustomer as any)(...args);
};

export const updateCustomer = async (...args: Parameters<typeof db.updateCustomer>) => {
  return (db.updateCustomer as any)(...args);
};

export const addLedgerEntry = async (...args: Parameters<typeof db.addLedgerEntry>) => {
  return (db.addLedgerEntry as any)(...args);
};

export const getLedgerEntries = async (...args: Parameters<typeof db.getLedgerEntries>) => {
  return (db.getLedgerEntries as any)(...args);
};

export const listCategories = async (...args: Parameters<typeof db.listCategories>) => {
  return (db.listCategories as any)(...args);
};

export const addCategory = async (...args: Parameters<typeof db.addCategory>) => {
  return (db.addCategory as any)(...args);
};

export const listBrands = async (...args: Parameters<typeof db.listBrands>) => {
  return (db.listBrands as any)(...args);
};

export const addBrand = async (...args: Parameters<typeof db.addBrand>) => {
  return (db.addBrand as any)(...args);
};

export const getAllItems = async (...args: Parameters<typeof db.getAllItems>) => {
  return (db.getAllItems as any)(...args);
};

export const addItem = async (...args: Parameters<typeof db.addItem>) => {
  return (db.addItem as any)(...args);
};

export const deleteItem = async (...args: Parameters<typeof db.deleteItem>) => {
  return (db.deleteItem as any)(...args);
};

export const deleteLedgerEntry = async (...args: Parameters<typeof db.deleteLedgerEntry>) => {
  return (db.deleteLedgerEntry as any)(...args);
};

export const listAuditLogs = async (...args: Parameters<typeof db.listAuditLogs>) => {
  return (db.listAuditLogs as any)(...args);
};

export const getCustomerSummary = async (...args: Parameters<typeof db.getCustomerSummary>) => {
  return (db.getCustomerSummary as any)(...args);
};

export const getLedgerAging = async (...args: Parameters<typeof db.getLedgerAging>) => {
  return (db.getLedgerAging as any)(...args);
};
