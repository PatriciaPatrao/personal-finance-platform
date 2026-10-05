export interface AnalysisSummary {
  from_date: string;
  to_date: string;
  total_income: string;
  total_expenses: string;
  net_cash_flow: string;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: string;
  percentage: string;
}

export interface ExpensesByCategory {
  from_date: string;
  to_date: string;
  total_expenses: string;
  categories: ExpenseCategoryBreakdown[];
}

export type CashFlowGroupBy = 'day' | 'month';

export interface CashFlowPeriod {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
}

export interface CashFlow {
  from_date: string;
  to_date: string;
  group_by: CashFlowGroupBy;
  periods: CashFlowPeriod[];
}
