/** Designation of Account money toward a Goal. */
export interface GoalAllocation {
  id: number;
  goal_id: number;
  account_id: number;
  amount: string;
  funded_amount: string;
  created_at: string;
}

/** Financial goal returned by the API, including derived fields. */
export interface FinancialGoal {
  id: number;
  name: string;
  target_amount: string;
  currency: string;
  target_date: string | null;
  created_at: string;
  allocations: GoalAllocation[];
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
}

/** Payload for creating a goal allocation. */
export interface GoalAllocationCreate {
  account_id: number;
  amount: number;
}

/** Payload for updating a goal allocation amount. */
export interface GoalAllocationUpdate {
  amount: number;
}
