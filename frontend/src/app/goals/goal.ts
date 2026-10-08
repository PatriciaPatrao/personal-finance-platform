/** Financial goal returned by the API, including derived fields. */
export interface FinancialGoal {
  id: number;
  name: string;
  target_amount: string;
  currency: string;
  target_date: string | null;
  account_id: number | null;
  created_at: string;
  current_amount: string | null;
  progress: string | null;
  completed: boolean | null;
}

/** Payload for creating or updating a financial goal. */
export interface FinancialGoalWrite {
  name: string;
  target_amount: number;
  currency: string;
  target_date: string | null;
  account_id: number | null;
}
