import {
  currentForecastPeriodKey,
  isCurrentForecastPeriod,
  netIncomeSignLabel,
  projectedBalanceSparkPoints,
  projectedBalanceSparkTrend,
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

    expect(points[0].heightPercent).toBe(15);
    expect(points[1].heightPercent).toBe(100);
    expect(points[0].heightPercent).toBeLessThan(points[1].heightPercent);
    expect(points[0].changeFromPrevious).toBeNull();
    expect(points[1].changeFromPrevious).toBe('up');
  });

  it('should scale large balances with a visible height spread', () => {
    const points = projectedBalanceSparkPoints([
      {
        period: '2026-10',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '86917.40',
      },
      {
        period: '2026-11',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '88392.40',
      },
      {
        period: '2026-12',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '89867.40',
      },
    ]);

    expect(points[0].heightPercent).toBe(15);
    expect(points[2].heightPercent).toBe(100);
    expect(points[1].heightPercent).toBeGreaterThan(points[0].heightPercent);
    expect(points[1].heightPercent).toBeLessThan(points[2].heightPercent);
    expect(projectedBalanceSparkTrend([
      {
        period: '2026-10',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '86917.40',
      },
      {
        period: '2026-12',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '89867.40',
      },
    ])).toBe('rising');
  });

  it('should use flat heights and stable trend when balances are unchanged', () => {
    const periods = [
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
        projected_balance: '1000.00',
      },
    ];
    const points = projectedBalanceSparkPoints(periods);

    expect(points[0].heightPercent).toBe(points[1].heightPercent);
    expect(points[1].changeFromPrevious).toBe('flat');
    expect(projectedBalanceSparkTrend(periods)).toBe('stable');
  });

  it('should compare the first bar against the starting balance', () => {
    const points = projectedBalanceSparkPoints(
      [
        {
          period: '2026-10',
          income: '0.00',
          expenses: '0.00',
          net_cash_flow: '0.00',
          projected_balance: '2100.00',
        },
      ],
      '2000.00',
    );

    expect(points[0].changeFromPrevious).toBe('up');
  });
});
