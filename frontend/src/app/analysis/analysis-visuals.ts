import { parseMoneyMinorUnits } from '../shared/money-units';
import { CashFlowPeriod } from './analysis-summary';

export type NetFlowSignLabel = 'Surplus' | 'Deficit' | 'Break-even';

export function netCashFlowSignLabel(netCashFlow: string): NetFlowSignLabel {
  const minor = parseMoneyMinorUnits(netCashFlow);
  if (minor > 0n) {
    return 'Surplus';
  }
  if (minor < 0n) {
    return 'Deficit';
  }
  return 'Break-even';
}

export function incomeExpenseBarWidths(
  income: string,
  expenses: string,
): { incomePercent: number; expensePercent: number } {
  const incomeMinor = parseMoneyMinorUnits(income);
  const expenseMinor = parseMoneyMinorUnits(expenses);
  if (incomeMinor <= 0n && expenseMinor <= 0n) {
    return { incomePercent: 0, expensePercent: 0 };
  }

  const total = incomeMinor + expenseMinor;
  if (total === 0n) {
    return { incomePercent: 50, expensePercent: 50 };
  }

  const incomePercent = Number((incomeMinor * 100n) / total);
  return {
    incomePercent,
    expensePercent: 100 - incomePercent,
  };
}

export function categoryShareBarWidth(percentage: string): number {
  const parsed = Number(percentage);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

export interface CashFlowSparkBar {
  period: string;
  netCashFlow: string;
  heightPercent: number;
  signLabel: NetFlowSignLabel;
}

export function cashFlowNetSparkBars(
  periods: CashFlowPeriod[],
): CashFlowSparkBar[] {
  if (periods.length === 0) {
    return [];
  }

  const magnitudes = periods.map((period) => {
    const net = parseMoneyMinorUnits(period.net_cash_flow);
    return net < 0n ? -net : net;
  });
  const maxMagnitude = magnitudes.reduce(
    (max, value) => (value > max ? value : max),
    0n,
  );

  return periods.map((period, index) => {
    const signLabel = netCashFlowSignLabel(period.net_cash_flow);
    if (maxMagnitude === 0n) {
      return {
        period: period.period,
        netCashFlow: period.net_cash_flow,
        heightPercent: 0,
        signLabel,
      };
    }

    const heightPercent = Number(
      (magnitudes[index] * 100n) / maxMagnitude,
    );
    return {
      period: period.period,
      netCashFlow: period.net_cash_flow,
      heightPercent: Math.max(heightPercent, signLabel === 'Break-even' ? 0 : 8),
      signLabel,
    };
  });
}

export function latestPeriodKey(periods: CashFlowPeriod[]): string | null {
  if (periods.length === 0) {
    return null;
  }

  return periods[periods.length - 1].period;
}
