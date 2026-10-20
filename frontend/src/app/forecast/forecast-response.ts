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

/** First projection in API order; not safe for household signals when length !== 1. */
export function primaryProjection(
  forecast: ForecastResponse,
): ForecastCurrencyProjection | null {
  return forecast.projections?.[0] ?? null;
}

/** Projection used for dashboard forecast signals (exactly one currency only). */
export function projectionForFinancialSignals(
  forecast: ForecastResponse,
): ForecastCurrencyProjection | null {
  const projections = forecast.projections ?? [];
  if (projections.length !== 1) {
    return null;
  }
  return projections[0];
}

export function projectionForCurrency(
  forecast: ForecastResponse,
  currency: string,
): ForecastCurrencyProjection | null {
  return (
    forecast.projections?.find((projection) => projection.currency === currency) ??
    null
  );
}
