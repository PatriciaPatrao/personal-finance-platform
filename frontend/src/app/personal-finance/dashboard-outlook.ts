import { ForecastResponse } from '../forecast/forecast-response';
import {
  BalanceSparkTrend,
  projectedBalanceSparkTrend,
} from '../forecast/forecast-visuals';

export type DashboardOutlookGroup = {
  currency: string;
  startingBalance: string;
  endingBalance: string;
  trend: BalanceSparkTrend;
  trendDetail: string;
};

export function outlookTrendDetail(trend: BalanceSparkTrend): string {
  switch (trend) {
    case 'rising':
      return 'Projected balance rises over the scheduled forecast window.';
    case 'falling':
      return 'Projected balance falls over the scheduled forecast window.';
    case 'stable':
      return 'Projected balance stays level over the scheduled forecast window.';
  }
}

export function buildDashboardOutlookGroups(
  forecast: ForecastResponse | null,
): DashboardOutlookGroup[] {
  if (!forecast?.projections?.length) {
    return [];
  }

  return forecast.projections.map((projection) => {
    const periods = projection.periods ?? [];
    const endingBalance =
      periods.length > 0
        ? periods[periods.length - 1].projected_balance
        : projection.starting_balance;
    const trend = projectedBalanceSparkTrend(periods);

    return {
      currency: projection.currency,
      startingBalance: projection.starting_balance,
      endingBalance,
      trend,
      trendDetail: outlookTrendDetail(trend),
    };
  });
}
