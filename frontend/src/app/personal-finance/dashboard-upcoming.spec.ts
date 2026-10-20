import { Account } from '../accounts/account';
import { Income } from '../schedules/income';
import { RecurringExpense } from '../schedules/recurring-expense';
import {
  addIsoDays,
  buildUpcomingCommitments,
  groupUpcomingByCurrency,
  hasActiveScheduleOccurrenceWithinDays,
} from './dashboard-upcoming';

const accounts: Account[] = [
  {
    id: 1,
    name: 'Main EUR',
    account_type: 'bank',
    currency: 'EUR',
    current_balance: '100.00',
    created_at: '2026-01-01T00:00:00',
  },
  {
    id: 2,
    name: 'USD account',
    account_type: 'bank',
    currency: 'USD',
    current_balance: '50.00',
    created_at: '2026-01-01T00:00:00',
  },
];

describe('buildUpcomingCommitments', () => {
  const window = { windowFrom: '2026-10-05', windowTo: '2026-12-31' };

  it('includes active schedules with next occurrence in the window', () => {
    const incomes: Income[] = [
      {
        id: 1,
        account_id: 1,
        amount: '2000.00',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2026-11-01',
        end_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00',
      },
    ];
    const expenses: RecurringExpense[] = [
      {
        id: 2,
        account_id: 2,
        description: 'Rent',
        amount: '500.00',
        category: 'housing',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2026-10-15',
        end_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00',
      },
    ];

    const items = buildUpcomingCommitments({
      ...window,
      incomes,
      expenses,
      accounts,
    });

    expect(items.map((item) => item.key)).toEqual(['expense-2', 'income-1']);
    expect(items[0]?.currency).toBe('USD');
    expect(items[1]?.description).toBe('Salary');
  });

  it('excludes inactive schedules and occurrences outside the window', () => {
    const incomes: Income[] = [
      {
        id: 1,
        account_id: 1,
        amount: '100.00',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2027-01-01',
        end_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00',
      },
      {
        id: 2,
        account_id: 1,
        amount: '100.00',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2026-11-01',
        end_date: null,
        active: false,
        created_at: '2026-01-01T00:00:00',
      },
    ];

    expect(
      buildUpcomingCommitments({
        ...window,
        incomes,
        expenses: [],
        accounts,
      }),
    ).toEqual([]);
  });

  it('skips schedules whose account is missing', () => {
    const incomes: Income[] = [
      {
        id: 1,
        account_id: 99,
        amount: '100.00',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2026-11-01',
        end_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00',
      },
    ];

    expect(
      buildUpcomingCommitments({
        ...window,
        incomes,
        expenses: [],
        accounts,
      }),
    ).toEqual([]);
  });

  it('does not duplicate the same schedule row', () => {
    const incomes: Income[] = [
      {
        id: 1,
        account_id: 1,
        amount: '100.00',
        frequency: 'monthly',
        start_date: '2026-01-01',
        next_occurrence: '2026-11-01',
        end_date: null,
        active: true,
        created_at: '2026-01-01T00:00:00',
      },
    ];

    const items = buildUpcomingCommitments({
      ...window,
      incomes,
      expenses: [],
      accounts,
    });

    expect(items).toHaveLength(1);
  });
});

describe('addIsoDays', () => {
  it('adds days across month boundaries', () => {
    expect(addIsoDays('2026-01-28', 5)).toBe('2026-02-02');
  });

  it('handles leap-day arithmetic', () => {
    expect(addIsoDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('hasActiveScheduleOccurrenceWithinDays', () => {
  const income = (
    nextOccurrence: string,
    active = true,
  ): Income => ({
    id: 1,
    account_id: 1,
    amount: '100.00',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: nextOccurrence,
    end_date: null,
    active,
    created_at: '2026-01-01T00:00:00',
  });

  it('includes occurrences after today through seven days ahead', () => {
    expect(
      hasActiveScheduleOccurrenceWithinDays(
        [income('2026-10-21'), income('2026-10-28')],
        [],
        '2026-10-20',
        7,
      ),
    ).toBe(true);
  });

  it('excludes today and occurrences beyond the seven-day horizon', () => {
    expect(
      hasActiveScheduleOccurrenceWithinDays(
        [income('2026-10-20'), income('2026-10-28')],
        [],
        '2026-10-20',
        7,
      ),
    ).toBe(false);
  });
});

describe('groupUpcomingByCurrency', () => {
  it('preserves currency separation', () => {
    const groups = groupUpcomingByCurrency([
      {
        key: 'expense-1',
        kind: 'expense',
        scheduleId: 1,
        occurrenceDate: '2026-10-10',
        description: 'Rent',
        amount: '500.00',
        currency: 'EUR',
        accountId: 1,
        accountLabel: 'Main EUR',
      },
      {
        key: 'income-1',
        kind: 'income',
        scheduleId: 1,
        occurrenceDate: '2026-10-20',
        description: 'Salary',
        amount: '2000.00',
        currency: 'USD',
        accountId: 2,
        accountLabel: 'USD account',
      },
    ]);

    expect(groups.map((group) => group.currency)).toEqual(['EUR', 'USD']);
  });

  it('orders currency groups alphabetically', () => {
    const groups = groupUpcomingByCurrency([
      {
        key: 'income-1',
        kind: 'income',
        scheduleId: 1,
        occurrenceDate: '2026-10-20',
        description: 'Salary',
        amount: '2000.00',
        currency: 'USD',
        accountId: 2,
        accountLabel: 'USD account',
      },
      {
        key: 'expense-1',
        kind: 'expense',
        scheduleId: 1,
        occurrenceDate: '2026-10-10',
        description: 'Rent',
        amount: '500.00',
        currency: 'EUR',
        accountId: 1,
        accountLabel: 'Main EUR',
      },
    ]);

    expect(groups.map((group) => group.currency)).toEqual(['EUR', 'USD']);
  });
});
