export type Shop = {
  id: number;
  shop_name: string;
  owner_name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type Customer = {
  id: number;
  shop_id: number;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
};

export type LedgerEntry = {
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
  created_at: string;
};

export type Category = {
  id: number;
  shop_id: number;
  name: string;
  created_at: string;
};

export type Brand = {
  id: number;
  shop_id: number;
  name: string;
  category_id: number;
  created_at: string;
};

export type Item = {
  id: number;
  shop_id: number;
  name: string;
  category_id: number;
  brand_id: number;
  default_rate: number | null;
  unit: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
};

export type CustomerSummary = {
  balance: number;
  totalDebit: number;
  totalCredit: number;
};

export type LedgerAging = {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  older: number;
};

export type AuditLog = {
  id: number;
  shop_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  created_at: string;
};

export type AddShopPayload = {
  shop_name: string;
  owner_name: string;
  email: string;
  password_hash: string;
};

export type AddCustomerPayload = {
  shop_id: number;
  name: string;
  phone?: string;
  address?: string;
};

export type UpdateCustomerPayload = {
  id: number;
  shop_id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
};

export type AddLedgerEntryPayload = {
  shop_id: number;
  customerId: number;
  itemId?: number | null;
  itemName: string;
  quantity: number;
  rate?: number | null;
  unit?: string | null;
  entryType: "debit" | "credit";
  affectsBalance?: boolean;
  note?: string;
};

export type AddBrandPayload = {
  shop_id: number;
  name: string;
  categoryId: number | null;
};

export type AddCategoryPayload = {
  shop_id: number;
  name: string;
};

export type AddItemPayload = {
  shop_id: number;
  id?: number;
  name: string;
  categoryId: number;
  brandId: number;
  defaultRate?: number | null;
  unit?: string | null;
  stockQuantity?: number | null;
  lowStockThreshold?: number | null;
};

export type ItemFilters = {
  shop_id: number;
  categoryId?: number | null;
  brandId?: number | null;
};