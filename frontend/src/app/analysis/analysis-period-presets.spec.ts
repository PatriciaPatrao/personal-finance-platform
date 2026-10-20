import {
  activePeriodPreset,
  lastMonthRange,
  thisMonthRange,
} from './analysis-period-presets';

describe('analysis-period-presets', () => {
  const today = new Date(2026, 9, 20);

  it('should detect this month and last month presets', () => {
    const thisMonth = thisMonthRange(today);
    const lastMonth = lastMonthRange(today);

    expect(activePeriodPreset(thisMonth.from, thisMonth.to, today)).toBe(
      'this-month',
    );
    expect(activePeriodPreset(lastMonth.from, lastMonth.to, today)).toBe(
      'last-month',
    );
    expect(activePeriodPreset('2026-01-01', '2026-01-31', today)).toBeNull();
  });

  it('should return full last calendar month ending on the last day', () => {
    expect(lastMonthRange(today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });
});
