import { ScheduleFrequency } from './income';

/** Fixed recurring expense returned by the API. */
export interface RecurringExpense {
  id: number;
  account_id: number;
  description: string;
  amount: string;
  category: string | null;
  frequency: ScheduleFrequency;
  start_date: string;
  next_occurrence: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

/** Payload for creating or fully updating a recurring expense. */
export interface RecurringExpenseWrite {
  account_id: number;
  description: string;
  amount: number;
  category: string | null;
  frequency: ScheduleFrequency;
  start_date: string;
  next_occurrence: string;
  end_date: string | null;
  active: boolean;
}
