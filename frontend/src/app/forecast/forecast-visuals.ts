import { parseMoneyMinorUnits } from '../shared/money-units';
import { ForecastGroupBy, ForecastPeriod } from './forecast-response';

export type NetFlowSignLabel = 'Surplus' | 'Deficit' | 'Break-even';

export function netIncomeSignLabel(netIncome: string): NetFlowSignLabel {
  const minor = parseMoneyMinorUnits(netIncome);
  if (minor > 0n) {
    return 'Surplus';
  }
  if (minor < 0n) {
    return 'Deficit';
  }
  return 'Break-even';
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentForecastPeriodKey(
  groupBy: ForecastGroupBy,
  today: Date = new Date(),
): string {
  if (groupBy === 'day') {
    return formatIsoDate(today);
  }

  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${today.getFullYear()}-${month}`;
}

export function isCurrentForecastPeriod(
  period: ForecastPeriod,
  groupBy: ForecastGroupBy,
  today: Date = new Date(),
): boolean {
  return period.period === currentForecastPeriodKey(groupBy, today);
}

export interface BalanceSparkPoint {
  period: string;
  projectedBalance: string;
  heightPercent: number;
}

export function projectedBalanceSparkPoints(
  periods: ForecastPeriod[],
): BalanceSparkPoint[] {
  if (periods.length === 0) {
    return [];
  }

  const balances = periods.map((period) =>
    parseMoneyMinorUnits(period.projected_balance),
  );
  let min = balances[0];
  let max = balances[0];
  for (const value of balances) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  const span = max - min;
  return periods.map((period, index) => {
    if (span === 0n) {
      return {
        period: period.period,
        projectedBalance: period.projected_balance,
        heightPercent: 50,
      };
    }

    const heightPercent = Number(((balances[index] - min) * 100n) / span);
    return {
      period: period.period,
      projectedBalance: period.projected_balance,
      heightPercent: Math.max(8, heightPercent),
    };
  });
}
