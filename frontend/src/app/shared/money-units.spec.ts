import {
  formatMoneyMinorUnits,
  minorUnitsToApiAmount,
  parseMoneyMinorUnits,
} from './money-units';

describe('money-units', () => {
  it('should round-trip two-decimal amounts through minor units', () => {
    expect(formatMoneyMinorUnits(parseMoneyMinorUnits('123.45'))).toBe('123.45');
    expect(minorUnitsToApiAmount(parseMoneyMinorUnits('0.01'))).toBe(0.01);
  });

  it('should sum designated amounts without float drift', () => {
    const parts = ['33.33', '33.33', '33.34'];
    const totalMinor = parts.reduce(
      (sum, part) => sum + parseMoneyMinorUnits(part),
      0n,
    );
    expect(formatMoneyMinorUnits(totalMinor)).toBe('100.00');
  });
});
