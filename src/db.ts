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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addShop as any)(...args);
};

export const findShopByEmail = async (...args: Parameters<typeof db.findShopByEmail>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.findShopByEmail as any)(...args);
};

export const listCustomers = async (...args: Parameters<typeof db.listCustomers>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.listCustomers as any)(...args);
};

export const addCustomer = async (...args: Parameters<typeof db.addCustomer>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addCustomer as any)(...args);
};

export const updateCustomer = async (...args: Parameters<typeof db.updateCustomer>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.updateCustomer as any)(...args);
};

export const addLedgerEntry = async (...args: Parameters<typeof db.addLedgerEntry>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addLedgerEntry as any)(...args);
};

export const getLedgerEntries = async (...args: Parameters<typeof db.getLedgerEntries>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.getLedgerEntries as any)(...args);
};

export const listCategories = async (...args: Parameters<typeof db.listCategories>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.listCategories as any)(...args);
};

export const addCategory = async (...args: Parameters<typeof db.addCategory>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addCategory as any)(...args);
};

export const listBrands = async (...args: Parameters<typeof db.listBrands>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.listBrands as any)(...args);
};

export const addBrand = async (...args: Parameters<typeof db.addBrand>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addBrand as any)(...args);
};

export const getAllItems = async (...args: Parameters<typeof db.getAllItems>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.getAllItems as any)(...args);
};

export const addItem = async (...args: Parameters<typeof db.addItem>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.addItem as any)(...args);
};

export const deleteItem = async (...args: Parameters<typeof db.deleteItem>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.deleteItem as any)(...args);
};

export const deleteLedgerEntry = async (...args: Parameters<typeof db.deleteLedgerEntry>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.deleteLedgerEntry as any)(...args);
};

export const listAuditLogs = async (...args: Parameters<typeof db.listAuditLogs>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.listAuditLogs as any)(...args);
};

export const getCustomerSummary = async (...args: Parameters<typeof db.getCustomerSummary>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.getCustomerSummary as any)(...args);
};

export const getLedgerAging = async (...args: Parameters<typeof db.getLedgerAging>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.getLedgerAging as any)(...args);
};

