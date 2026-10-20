import {
  AnalysisSummary,
  CurrencyAnalysisTotals,
  singleCurrencySummaryTotals,
  summaryTotalsForCurrency,
} from '../analysis/analysis-summary';
import {
  ForecastCurrencyProjection,
  ForecastResponse,
  projectionForCurrency,
  projectionForFinancialSignals,
} from '../forecast/forecast-response';

export interface FinancialSignal {
  title: string;
  detail: string;
}

export interface CurrencyFinancialSignalGroup {
  currency: string;
  signals: FinancialSignal[];
  quietDetail: string;
}

function parseMoneyMinorUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = (match[3] ?? '00').padEnd(2, '0');
  return sign * (whole * 100n + BigInt(fraction));
}

function deriveCashFlowSignalFromTotals(
  totals: CurrencyAnalysisTotals,
): FinancialSignal | null {
  const income = parseMoneyMinorUnits(totals.total_income);
  const expenses = parseMoneyMinorUnits(totals.total_expenses);
  const netCashFlow = parseMoneyMinorUnits(totals.net_cash_flow);

  if (income === 0n && expenses === 0n) {
    return null;
  }

  if (netCashFlow > 0n) {
    return {
      title: 'Positive cash flow',
      detail: 'Your income is currently higher than your expenses.',
    };
  }

  if (netCashFlow < 0n) {
    return {
      title: 'Expenses exceeded income',
      detail: 'Your expenses are currently higher than your income.',
    };
  }

  return null;
}

function deriveCashFlowSignal(
  summary: AnalysisSummary | null,
): FinancialSignal | null {
  if (!summary) {
    return null;
  }

  const totals = singleCurrencySummaryTotals(summary);
  if (!totals) {
    return null;
  }

  return deriveCashFlowSignalFromTotals(totals);
}

function deriveForecastSignalsFromProjection(
  projection: ForecastCurrencyProjection | null,
): FinancialSignal[] {
  if (!projection || projection.periods.length === 0) {
    return [];
  }

  const signals: FinancialSignal[] = [];
  const hasScheduledIncome = projection.periods.some(
    (period) => parseMoneyMinorUnits(period.income) > 0n,
  );

  if (!hasScheduledIncome) {
    signals.push({
      title: 'No scheduled income',
      detail: 'No income is scheduled in the forecast period.',
    });
  }

  const startingBalance = parseMoneyMinorUnits(projection.starting_balance);

  const endingBalance = parseMoneyMinorUnits(
    projection.periods[projection.periods.length - 1].projected_balance,
  );

  if (endingBalance < startingBalance) {
    signals.push({
      title: 'Balance projected to decrease',
      detail:
        'Scheduled expenses are higher than scheduled income, so the projected balance is lower at the end of the period.',
    });
  } else if (endingBalance > startingBalance) {
    signals.push({
      title: 'Balance projected to increase',
      detail:
        'Scheduled income is higher than scheduled expenses, so the projected balance is higher at the end of the period.',
    });
  }

  return signals;
}

function deriveForecastSignals(
  forecast: ForecastResponse | null,
): FinancialSignal[] {
  const projection = forecast
    ? projectionForFinancialSignals(forecast)
    : null;
  return deriveForecastSignalsFromProjection(projection);
}

function europeanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

function analysisQuietSentence(
  summary: AnalysisSummary,
  totals: CurrencyAnalysisTotals,
): string {
  const income = parseMoneyMinorUnits(totals.total_income);
  const expenses = parseMoneyMinorUnits(totals.total_expenses);
  const range = `${europeanDate(summary.from_date)} to ${europeanDate(summary.to_date)}`;

  if (income === 0n && expenses === 0n) {
    return `Checked recorded cash flow from ${range}: no income or expenses were recorded.`;
  }

  return `Checked recorded cash flow from ${range}: recorded income and expenses were equal.`;
}

function forecastQuietSentence(
  forecast: ForecastResponse,
  projection: ForecastCurrencyProjection,
): string {
  const range = `${europeanDate(forecast.from_date)} to ${europeanDate(forecast.to_date)}`;

  if (projection.periods.length === 0) {
    return `Checked the forecast from ${range}: no forecast periods were returned.`;
  }

  return `Checked the forecast from ${range}: scheduled income is present and the projected balance is unchanged.`;
}

function quietCheckDetailForCurrency(
  summary: AnalysisSummary | null,
  forecast: ForecastResponse | null,
  currency: string,
): string {
  const parts: string[] = [];

  if (summary) {
    const totals = summaryTotalsForCurrency(summary, currency);
    if (totals && deriveCashFlowSignalFromTotals(totals) === null) {
      parts.push(analysisQuietSentence(summary, totals));
    }
  }

  if (forecast) {
    const projection = projectionForCurrency(forecast, currency);
    if (
      projection &&
      deriveForecastSignalsFromProjection(projection).length === 0
    ) {
      parts.push(forecastQuietSentence(forecast, projection));
    }
  }

  return parts.join(' ');
}

export function deriveFinancialSignals(
  summary: AnalysisSummary | null,
  forecast: ForecastResponse | null,
): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  const cashFlowSignal = deriveCashFlowSignal(summary);
  if (cashFlowSignal) {
    signals.push(cashFlowSignal);
  }
  signals.push(...deriveForecastSignals(forecast));
  return signals;
}

export function deriveFinancialSignalsByCurrency(
  summary: AnalysisSummary | null,
  forecast: ForecastResponse | null,
): CurrencyFinancialSignalGroup[] {
  const currencies = new Set<string>();
  summary?.by_currency.forEach((block) => currencies.add(block.currency));
  forecast?.projections?.forEach((projection) =>
    currencies.add(projection.currency),
  );

  return [...currencies]
    .sort((left, right) => left.localeCompare(right))
    .map((currency) => {
      const totals = summary
        ? summaryTotalsForCurrency(summary, currency)
        : null;
      const projection = forecast
        ? projectionForCurrency(forecast, currency)
        : null;

      const signals: FinancialSignal[] = [];
      if (totals) {
        const cashFlowSignal = deriveCashFlowSignalFromTotals(totals);
        if (cashFlowSignal) {
          signals.push(cashFlowSignal);
        }
      }
      signals.push(...deriveForecastSignalsFromProjection(projection));

      return {
        currency,
        signals,
        quietDetail: quietCheckDetailForCurrency(summary, forecast, currency),
      };
    });
}

export function signalActionRoute(title: string): string | null {
  switch (title) {
    case 'Positive cash flow':
    case 'Expenses exceeded income':
      return '/personal_finance/analysis';
    case 'No scheduled income':
      return '/personal_finance/schedules';
    case 'Balance projected to decrease':
    case 'Balance projected to increase':
      return '/personal_finance/forecast';
    default:
      return null;
  }
}

export function signalActionLabel(title: string): string {
  switch (title) {
    case 'Positive cash flow':
    case 'Expenses exceeded income':
      return 'Open Analysis';
    case 'No scheduled income':
      return 'Open Schedules';
    case 'Balance projected to decrease':
    case 'Balance projected to increase':
      return 'Open Forecast';
    default:
      return 'Open related view';
  }
}

export function signalActionIcon(title: string): string {
  switch (title) {
    case 'Positive cash flow':
    case 'Expenses exceeded income':
      return 'pi pi-chart-bar';
    case 'No scheduled income':
      return 'pi pi-calendar';
    case 'Balance projected to decrease':
    case 'Balance projected to increase':
      return 'pi pi-chart-line';
    default:
      return 'pi pi-arrow-right';
  }
}

export function quietCheckDetail(
  summary: AnalysisSummary | null,
  forecast: ForecastResponse | null,
): string {
  const parts: string[] = [];

  if (summary && deriveCashFlowSignal(summary) === null) {
    const totals = singleCurrencySummaryTotals(summary);
    if (totals) {
      parts.push(analysisQuietSentence(summary, totals));
    }
  }

  if (forecast && deriveForecastSignals(forecast).length === 0) {
    const projections = forecast.projections ?? [];
    if (projections.length === 0) {
      parts.push(
        `Checked the forecast from ${europeanDate(forecast.from_date)} to ${europeanDate(forecast.to_date)}: no forecast periods were returned.`,
      );
    } else {
      const projection = projectionForFinancialSignals(forecast);
      if (projection) {
        parts.push(forecastQuietSentence(forecast, projection));
      }
    }
  }

  return parts.join(' ');
}
