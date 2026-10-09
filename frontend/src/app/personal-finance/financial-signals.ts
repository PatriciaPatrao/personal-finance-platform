import { AnalysisSummary } from '../analysis/analysis-summary';
import { ForecastResponse } from '../forecast/forecast-response';

export interface FinancialSignal {
  title: string;
  detail: string;
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

function forecastStartingBalance(forecast: ForecastResponse): bigint | null {
  if (forecast.periods.length === 0) {
    return null;
  }

  const firstPeriod = forecast.periods[0];
  return (
    parseMoneyMinorUnits(firstPeriod.projected_balance) -
    parseMoneyMinorUnits(firstPeriod.net_cash_flow)
  );
}

function deriveCashFlowSignal(
  summary: AnalysisSummary | null,
): FinancialSignal | null {
  if (!summary) {
    return null;
  }

  const income = parseMoneyMinorUnits(summary.total_income);
  const expenses = parseMoneyMinorUnits(summary.total_expenses);
  const netCashFlow = parseMoneyMinorUnits(summary.net_cash_flow);

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

function deriveForecastSignals(
  forecast: ForecastResponse | null,
): FinancialSignal[] {
  if (!forecast || forecast.periods.length === 0) {
    return [];
  }

  const signals: FinancialSignal[] = [];
  const hasScheduledIncome = forecast.periods.some(
    (period) => parseMoneyMinorUnits(period.income) > 0n,
  );

  if (!hasScheduledIncome) {
    signals.push({
      title: 'No scheduled income',
      detail: 'No income is scheduled in the forecast period.',
    });
  }

  const startingBalance = forecastStartingBalance(forecast);
  if (startingBalance === null) {
    return signals;
  }

  const endingBalance = parseMoneyMinorUnits(
    forecast.periods[forecast.periods.length - 1].projected_balance,
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

function europeanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

function analysisQuietSentence(summary: AnalysisSummary): string {
  const income = parseMoneyMinorUnits(summary.total_income);
  const expenses = parseMoneyMinorUnits(summary.total_expenses);
  const range = `${europeanDate(summary.from_date)} to ${europeanDate(summary.to_date)}`;

  if (income === 0n && expenses === 0n) {
    return `Checked recorded cash flow from ${range}: no income or expenses were recorded.`;
  }

  return `Checked recorded cash flow from ${range}: recorded income and expenses were equal.`;
}

function forecastQuietSentence(forecast: ForecastResponse): string {
  const range = `${europeanDate(forecast.from_date)} to ${europeanDate(forecast.to_date)}`;

  if (forecast.periods.length === 0) {
    return `Checked the forecast from ${range}: no forecast periods were returned.`;
  }

  return `Checked the forecast from ${range}: scheduled income is present and the projected balance is unchanged.`;
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

export function quietCheckDetail(
  summary: AnalysisSummary | null,
  forecast: ForecastResponse | null,
): string {
  const parts: string[] = [];

  if (summary && deriveCashFlowSignal(summary) === null) {
    parts.push(analysisQuietSentence(summary));
  }

  if (forecast && deriveForecastSignals(forecast).length === 0) {
    parts.push(forecastQuietSentence(forecast));
  }

  return parts.join(' ');
}
