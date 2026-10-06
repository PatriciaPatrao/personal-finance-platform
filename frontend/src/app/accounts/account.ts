export type AccountType =
  | 'bank'
  | 'cash'
  | 'credit_card'
  | 'investment';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

export function accountTypeLabel(accountType: AccountType): string {
  return ACCOUNT_TYPE_LABELS[accountType];
}

export interface Account {
  id: number;
  name: string;
  account_type: AccountType;
  currency: string;
  current_balance: string;
  created_at: string;
}

export interface AccountCreate {
  name: string;
  account_type: AccountType;
  currency?: string;
  current_balance?: number;
}
