import * as sqliteDb from "./sqliteDb";

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

// We strictly use sqliteDb for now as requested for simplicity in the current conversion
// but keeping the wrapper structure for future postgres support if needed.

export const initDb = async (): Promise<void> => {
  sqliteDb.initDb();
};

export const addShop = async (...args: Parameters<typeof sqliteDb.addShop>) => {
  return sqliteDb.addShop(...args);
};

export const findShopByEmail = async (...args: Parameters<typeof sqliteDb.findShopByEmail>) => {
  return sqliteDb.findShopByEmail(...args);
};

export const listCustomers = async (...args: Parameters<typeof sqliteDb.listCustomers>) => {
  return sqliteDb.listCustomers(...args);
};

export const addCustomer = async (...args: Parameters<typeof sqliteDb.addCustomer>) => {
  return sqliteDb.addCustomer(...args);
};

export const updateCustomer = async (...args: Parameters<typeof sqliteDb.updateCustomer>) => {
  return sqliteDb.updateCustomer(...args);
};

export const addLedgerEntry = async (...args: Parameters<typeof sqliteDb.addLedgerEntry>) => {
  return sqliteDb.addLedgerEntry(...args);
};

export const getLedgerEntries = async (...args: Parameters<typeof sqliteDb.getLedgerEntries>) => {
  return sqliteDb.getLedgerEntries(...args);
};

export const listCategories = async (...args: Parameters<typeof sqliteDb.listCategories>) => {
  return sqliteDb.listCategories(...args);
};

export const addCategory = async (...args: Parameters<typeof sqliteDb.addCategory>) => {
  return sqliteDb.addCategory(...args);
};

export const listBrands = async (...args: Parameters<typeof sqliteDb.listBrands>) => {
  return sqliteDb.listBrands(...args);
};

export const addBrand = async (...args: Parameters<typeof sqliteDb.addBrand>) => {
  return sqliteDb.addBrand(...args);
};

export const getAllItems = async (...args: Parameters<typeof sqliteDb.getAllItems>) => {
  return sqliteDb.getAllItems(...args);
};

export const addItem = async (...args: Parameters<typeof sqliteDb.addItem>) => {
  return sqliteDb.addItem(...args);
};

export const deleteLedgerEntry = async (...args: Parameters<typeof sqliteDb.deleteLedgerEntry>) => {
  return sqliteDb.deleteLedgerEntry(...args);
};

export const listAuditLogs = async (...args: Parameters<typeof sqliteDb.listAuditLogs>) => {
  return sqliteDb.listAuditLogs(...args);
};

export const getCustomerSummary = async (...args: Parameters<typeof sqliteDb.getCustomerSummary>) => {
  return sqliteDb.getCustomerSummary(...args);
};

export const getLedgerAging = async (...args: Parameters<typeof sqliteDb.getLedgerAging>) => {
  return sqliteDb.getLedgerAging(...args);
};
