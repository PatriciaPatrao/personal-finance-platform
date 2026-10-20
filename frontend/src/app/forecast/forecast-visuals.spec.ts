import {
  currentForecastPeriodKey,
  isCurrentForecastPeriod,
  netIncomeSignLabel,
  projectedBalanceSparkPoints,
} from './forecast-visuals';

describe('forecast-visuals', () => {
  const today = new Date(2026, 9, 20);

  it('should identify the current monthly period key', () => {
    expect(currentForecastPeriodKey('month', today)).toBe('2026-10');
    expect(currentForecastPeriodKey('day', today)).toBe('2026-10-20');
  });

  it('should mark the matching forecast period row as current', () => {
    expect(
      isCurrentForecastPeriod(
        {
          period: '2026-10',
          income: '0.00',
          expenses: '0.00',
          net_cash_flow: '0.00',
          projected_balance: '100.00',
        },
        'month',
        today,
      ),
    ).toBe(true);
  });

  it('should label net income sign for styling and copy', () => {
    expect(netIncomeSignLabel('5.00')).toBe('Surplus');
    expect(netIncomeSignLabel('-5.00')).toBe('Deficit');
  });

  it('should normalise projected balance spark points within one series', () => {
    const points = projectedBalanceSparkPoints([
      {
        period: '2026-10',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '1000.00',
      },
      {
        period: '2026-11',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '1500.00',
      },
    ]);

    expect(points[0].heightPercent).toBeLessThan(points[1].heightPercent);
  });
});
