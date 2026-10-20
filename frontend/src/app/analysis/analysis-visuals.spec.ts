import {
  cashFlowNetSparkBars,
  incomeExpenseBarWidths,
  netCashFlowSignLabel,
} from './analysis-visuals';

describe('analysis-visuals', () => {
  it('should label net cash flow sign from API amounts', () => {
    expect(netCashFlowSignLabel('10.00')).toBe('Surplus');
    expect(netCashFlowSignLabel('-1.00')).toBe('Deficit');
    expect(netCashFlowSignLabel('0.00')).toBe('Break-even');
  });

  it('should scale income and expense bars within one currency block', () => {
    expect(incomeExpenseBarWidths('75.00', '25.00')).toEqual({
      incomePercent: 75,
      expensePercent: 25,
    });
  });

  it('should build spark bars without mixing periods from different data', () => {
    const bars = cashFlowNetSparkBars([
      {
        period: '2026-09',
        income: '100.00',
        expenses: '40.00',
        net_cash_flow: '60.00',
      },
      {
        period: '2026-10',
        income: '50.00',
        expenses: '80.00',
        net_cash_flow: '-30.00',
      },
    ]);

    expect(bars).toHaveLength(2);
    expect(bars[0].signLabel).toBe('Surplus');
    expect(bars[1].signLabel).toBe('Deficit');
    expect(bars[0].heightPercent).toBeGreaterThan(bars[1].heightPercent);
  });
});
