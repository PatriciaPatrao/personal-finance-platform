export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: number;
  account_id: number;
  description: string | null;
  amount: string;
  transaction_type: TransactionType;
  occurred_on: string;
  category: string | null;
  created_at: string;
  linked_to_schedule_execution: boolean;
}

export interface TransactionWrite {
  account_id: number;
  description?: string | null;
  amount: string;
  transaction_type: TransactionType;
  occurred_on: string;
  category?: string | null;
}
