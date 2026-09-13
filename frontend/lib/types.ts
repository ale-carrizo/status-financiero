export type BankProfile = 'VISA_SANTANDER' | 'AMEX_SANTANDER' | 'MASTERCARD_GALICIA' | 'VISA_GALICIA';

export type Category = 'EMPRESA' | 'PERSONAL' | 'IMPUESTO' | 'EXCLUIDO' | 'SIN_CLASIFICAR';

export type CardAccount = {
  id: string;
  label: string;
  bank_profile: BankProfile;
  card_number: string | null;
  is_active: boolean;
};

export type Transaction = {
  id: string;
  statement_id: string;
  fecha: string | null;
  descripcion: string;
  cardholder: string | null;
  cuota_actual: number | null;
  cuota_total: number | null;
  monto_ars: number;
  monto_usd: number;
  category: Category;
  concept_label: string | null;
  manual_override: boolean;
};

export type Statement = {
  id: string;
  card_account_id: string;
  card_account: CardAccount;
  period_label: string;
  closing_date: string;
  due_date: string;
  total_ars: number;
  total_usd: number;
  raw_file_name: string | null;
  transactions: Transaction[];
};

export type ClassificationRule = {
  id: string;
  keyword: string;
  concept_label: string;
  category: Category;
  card_account_id: string | null;
  card_account?: CardAccount | null;
  priority: number;
  active: boolean;
};

export type PlannedPurchase = {
  id: string;
  card_account_id: string;
  card_account?: CardAccount;
  descripcion: string;
  monto_total: number;
  cuotas: number;
  first_charge_month: string;
};

export type CategoryTotals = Record<Category, { ars: number; usd: number }>;

export type DashboardSummary = {
  period: string;
  byCard: {
    statement_id: string;
    card_account: CardAccount;
    total_ars: number;
    total_usd: number;
    totals: CategoryTotals;
  }[];
  consolidated: CategoryTotals;
};

export type ObligationType = 'LOAN' | 'MANUAL_CARD';

export type ManualObligation = {
  id: string;
  label: string;
  type: ObligationType;
  is_active: boolean;
  entries: { id: string; period_label: string; monto_ars: number; monto_usd: number }[];
};

export type CashflowCell = { ars: number; usd: number; actual: boolean };

export type CashflowRow = {
  id: string;
  label: string;
  type: 'CARD_AUTO' | ObligationType;
  cells: CashflowCell[];
};

export type Cashflow = {
  months: string[];
  rows: CashflowRow[];
  totals: { ars: number; usd: number }[];
  current_month: string;
};

export type ProjectionMonth = {
  month: string;
  ars: number;
  usd: number;
  items: { source: string; descripcion: string; cuota: string; monto_ars: number; monto_usd: number }[];
};
