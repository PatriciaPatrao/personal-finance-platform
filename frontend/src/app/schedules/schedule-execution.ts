/** Schedule occurrence execution API types. */

export type ScheduleSourceType = 'income' | 'recurring_expense';

export interface ScheduleExecutionCreate {
  occurrence_date: string;
}

export interface ScheduleExecution {
  id: number;
  source_type: ScheduleSourceType;
  source_id: number;
  occurrence_date: string;
  transaction_id: number;
  created_at: string;
  transaction_account_id: number;
  transaction_amount: string;
  transaction_type: 'income' | 'expense';
  transaction_occurred_on: string;
}

export interface ScheduleExecutionOutcome {
  execution: ScheduleExecution;
  created: boolean;
}
