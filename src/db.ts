import * as postgresDb from "./postgresDb";
import * as sqliteDb from "./sqliteDb";

export type {
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
  LedgerEntry
} from "./dbTypes";

const usePostgres = Boolean(process.env.DATABASE_URL);

export const initDb = async (): Promise<void> => {
  if (usePostgres) {
    await postgresDb.initDb();
    return;
  }
  sqliteDb.initDb();
};

export const listCustomers = async () => {
  return usePostgres ? postgresDb.listCustomers() : sqliteDb.listCustomers();
};

export const addCustomer = async (...args: Parameters<typeof postgresDb.addCustomer>) => {
  return usePostgres ? postgresDb.addCustomer(...args) : sqliteDb.addCustomer(...args);
};

export const addLedgerEntry = async (
  ...args: Parameters<typeof postgresDb.addLedgerEntry>
) => {
  return usePostgres
    ? postgresDb.addLedgerEntry(...args)
    : sqliteDb.addLedgerEntry(...args);
};

export const getLedgerEntries = async (
  ...args: Parameters<typeof postgresDb.getLedgerEntries>
) => {
  return usePostgres
    ? postgresDb.getLedgerEntries(...args)
    : sqliteDb.getLedgerEntries(...args);
};

export const listCategories = async () => {
  return usePostgres ? postgresDb.listCategories() : sqliteDb.listCategories();
};

export const addCategory = async (...args: Parameters<typeof postgresDb.addCategory>) => {
  return usePostgres ? postgresDb.addCategory(...args) : sqliteDb.addCategory(...args);
};

export const listBrands = async (...args: Parameters<typeof postgresDb.listBrands>) => {
  return usePostgres ? postgresDb.listBrands(...args) : sqliteDb.listBrands(...args);
};

export const addBrand = async (...args: Parameters<typeof postgresDb.addBrand>) => {
  return usePostgres ? postgresDb.addBrand(...args) : sqliteDb.addBrand(...args);
};

export const getAllItems = async (...args: Parameters<typeof postgresDb.getAllItems>) => {
  return usePostgres ? postgresDb.getAllItems(...args) : sqliteDb.getAllItems(...args);
};

export const addItem = async (...args: Parameters<typeof postgresDb.addItem>) => {
  return usePostgres ? postgresDb.addItem(...args) : sqliteDb.addItem(...args);
};

export const deleteItem = async (...args: Parameters<typeof postgresDb.deleteItem>) => {
  return usePostgres ? postgresDb.deleteItem(...args) : sqliteDb.deleteItem(...args);
};

export const listAuditLogs = async (...args: Parameters<typeof postgresDb.listAuditLogs>) => {
  return usePostgres ? postgresDb.listAuditLogs(...args) : sqliteDb.listAuditLogs(...args);
};

export const getCustomerSummary = async (
  ...args: Parameters<typeof postgresDb.getCustomerSummary>
) => {
  return usePostgres
    ? postgresDb.getCustomerSummary(...args)
    : sqliteDb.getCustomerSummary(...args);
};

export const getLedgerAging = async (...args: Parameters<typeof postgresDb.getLedgerAging>) => {
  return usePostgres ? postgresDb.getLedgerAging(...args) : sqliteDb.getLedgerAging(...args);
};
