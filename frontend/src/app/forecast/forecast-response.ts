export type ForecastGroupBy = 'day' | 'month';

export interface ForecastPeriod {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
  projected_balance: string;
}

export type ForecastScope = 'household' | 'account';

export interface ForecastResponse {
  from_date: string;
  to_date: string;
  currency: string;
  scope: ForecastScope;
  account_id: number | null;
  group_by: ForecastGroupBy;
  periods: ForecastPeriod[];
}
