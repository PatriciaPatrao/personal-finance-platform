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

export type BalanceSparkTrend = 'rising' | 'falling' | 'stable';

export type BalanceSparkChange = 'up' | 'down' | 'flat';

export interface BalanceSparkPoint {
  period: string;
  projectedBalance: string;
  heightPercent: number;
  changeFromPrevious: BalanceSparkChange | null;
}

const SPARKLINE_MIN_HEIGHT_PERCENT = 15;
const SPARKLINE_MAX_HEIGHT_PERCENT = 100;

export function projectedBalanceSparkTrend(
  periods: ForecastPeriod[],
): BalanceSparkTrend {
  if (periods.length < 2) {
    return 'stable';
  }

  const first = parseMoneyMinorUnits(periods[0].projected_balance);
  const last = parseMoneyMinorUnits(
    periods[periods.length - 1].projected_balance,
  );
  if (last > first) {
    return 'rising';
  }
  if (last < first) {
    return 'falling';
  }
  return 'stable';
}

function balanceSparkChange(
  current: bigint,
  previous: bigint,
): BalanceSparkChange {
  if (current > previous) {
    return 'up';
  }
  if (current < previous) {
    return 'down';
  }
  return 'flat';
}

export function projectedBalanceSparkPoints(
  periods: ForecastPeriod[],
  startingBalance?: string,
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
  const heightRange =
    SPARKLINE_MAX_HEIGHT_PERCENT - SPARKLINE_MIN_HEIGHT_PERCENT;

  return periods.map((period, index) => {
    const previousBalance =
      index === 0 && startingBalance !== undefined
        ? parseMoneyMinorUnits(startingBalance)
        : index > 0
          ? balances[index - 1]
          : null;

    const changeFromPrevious =
      previousBalance === null
        ? null
        : balanceSparkChange(balances[index], previousBalance);

    if (span === 0n) {
      return {
        period: period.period,
        projectedBalance: period.projected_balance,
        heightPercent:
          (SPARKLINE_MIN_HEIGHT_PERCENT + SPARKLINE_MAX_HEIGHT_PERCENT) / 2,
        changeFromPrevious,
      };
    }

    const scaledOffset = Number(
      ((balances[index] - min) * BigInt(heightRange)) / span,
    );
    return {
      period: period.period,
      projectedBalance: period.projected_balance,
      heightPercent: SPARKLINE_MIN_HEIGHT_PERCENT + scaledOffset,
      changeFromPrevious,
    };
  });
}
