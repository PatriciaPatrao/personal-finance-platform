/** Frequency values accepted by the incomes API. */
export type ScheduleFrequency = 'weekly' | 'monthly' | 'yearly';

/** Salary schedule returned by the API. */
export interface Income {
  id: number;
  account_id: number;
  amount: string;
  frequency: ScheduleFrequency;
  start_date: string;
  next_occurrence: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

/** Payload for creating or fully updating a salary schedule. */
export interface IncomeWrite {
  account_id: number;
  amount: number;
  frequency: ScheduleFrequency;
  start_date: string;
  next_occurrence: string;
  end_date: string | null;
  active: boolean;
}
