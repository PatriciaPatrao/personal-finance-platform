import { buildDashboardOutlookGroups } from './dashboard-outlook';
import { ForecastResponse } from '../forecast/forecast-response';

describe('dashboard-outlook', () => {
  const sampleForecast: ForecastResponse = {
    from_date: '2026-10-01',
    to_date: '2026-12-31',
    scope: 'household',
    account_id: null,
    group_by: 'month',
    projections: [
      {
        currency: 'EUR',
        group_by: 'month',
        starting_balance: '5000.00',
        periods: [
          {
            period: '2026-10',
            income: '2000.00',
            expenses: '1250.00',
            net_cash_flow: '750.00',
            projected_balance: '5750.00',
          },
          {
            period: '2026-11',
            income: '2000.00',
            expenses: '1250.00',
            net_cash_flow: '750.00',
            projected_balance: '6500.00',
          },
        ],
      },
    ],
  };

  it('should derive ending balance and rising trend from loaded forecast projections', () => {
    const groups = buildDashboardOutlookGroups(sampleForecast);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({
      currency: 'EUR',
      startingBalance: '5000.00',
      endingBalance: '6500.00',
      trend: 'rising',
      trendDetail:
        'Projected balance rises over the scheduled forecast window.',
    });
  });

  it('should return no groups when forecast is missing', () => {
    expect(buildDashboardOutlookGroups(null)).toEqual([]);
  });
});
