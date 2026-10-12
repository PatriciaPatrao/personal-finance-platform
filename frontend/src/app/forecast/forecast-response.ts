export type ForecastGroupBy = 'day' | 'month';

export interface ForecastPeriod {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
  projected_balance: string;
}

export type ForecastScope = 'household' | 'account';

export interface ForecastCurrencyProjection {
  currency: string;
  group_by: ForecastGroupBy;
  starting_balance: string;
  periods: ForecastPeriod[];
}

export interface ForecastResponse {
  from_date: string;
  to_date: string;
  scope: ForecastScope;
  account_id: number | null;
  group_by: ForecastGroupBy;
  projections: ForecastCurrencyProjection[];
}

export function primaryProjection(
  forecast: ForecastResponse,
): ForecastCurrencyProjection | null {
  return forecast.projections?.[0] ?? null;
}
