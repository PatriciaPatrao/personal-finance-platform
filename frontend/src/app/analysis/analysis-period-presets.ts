function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toEuropeanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

export function thisMonthRange(today: Date = new Date()): {
  from: string;
  to: string;
} {
  return {
    from: formatIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatIsoDate(today),
  };
}

export function lastMonthRange(today: Date = new Date()): {
  from: string;
  to: string;
} {
  const lastOfPrevious = new Date(today.getFullYear(), today.getMonth(), 0);
  return {
    from: formatIsoDate(
      new Date(lastOfPrevious.getFullYear(), lastOfPrevious.getMonth(), 1),
    ),
    to: formatIsoDate(lastOfPrevious),
  };
}

export type PeriodPresetId = 'this-month' | 'last-month';

export function activePeriodPreset(
  from: string,
  to: string,
  today: Date = new Date(),
): PeriodPresetId | null {
  const thisMonth = thisMonthRange(today);
  if (from === thisMonth.from && to === thisMonth.to) {
    return 'this-month';
  }

  const lastMonth = lastMonthRange(today);
  if (from === lastMonth.from && to === lastMonth.to) {
    return 'last-month';
  }

  return null;
}

export function formatPeriodRangeLabel(from: string, to: string): string {
  return `${toEuropeanDate(from)} to ${toEuropeanDate(to)}`;
}
