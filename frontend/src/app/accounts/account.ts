export type AccountType =
  | 'bank'
  | 'cash'
  | 'credit_card'
  | 'investment';

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
  current_balance?: string;
}
