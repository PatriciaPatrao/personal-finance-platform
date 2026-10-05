export type ForecastGroupBy = 'day' | 'month';

export interface ForecastPeriod {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
  projected_balance: string;
}

export interface ForecastResponse {
  from_date: string;
  to_date: string;
  currency: string;
  group_by: ForecastGroupBy;
  periods: ForecastPeriod[];
}
