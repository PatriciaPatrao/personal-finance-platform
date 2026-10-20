export interface CurrencyAnalysisTotals {
  currency: string;
  total_income: string;
  total_expenses: string;
  net_cash_flow: string;
}

export interface AnalysisSummary {
  from_date: string;
  to_date: string;
  by_currency: CurrencyAnalysisTotals[];
}

export interface ExpenseCategoryBreakdown {
  category: string;
  amount: string;
  percentage: string;
}

export interface CurrencyExpensesByCategory {
  currency: string;
  total_expenses: string;
  categories: ExpenseCategoryBreakdown[];
}

export interface ExpensesByCategory {
  from_date: string;
  to_date: string;
  currencies: CurrencyExpensesByCategory[];
}

export type CashFlowGroupBy = 'day' | 'month';

export interface CashFlowPeriod {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
}

export interface CurrencyCashFlow {
  currency: string;
  periods: CashFlowPeriod[];
}

export interface CashFlow {
  from_date: string;
  to_date: string;
  group_by: CashFlowGroupBy;
  currencies: CurrencyCashFlow[];
}

/** Single-currency summary for dashboard signals when exactly one block exists. */
export function singleCurrencySummaryTotals(
  summary: AnalysisSummary,
): CurrencyAnalysisTotals | null {
  if (summary.by_currency.length !== 1) {
    return null;
  }

  return summary.by_currency[0];
}

export function summaryTotalsForCurrency(
  summary: AnalysisSummary,
  currency: string,
): CurrencyAnalysisTotals | null {
  return summary.by_currency.find((block) => block.currency === currency) ?? null;
}
