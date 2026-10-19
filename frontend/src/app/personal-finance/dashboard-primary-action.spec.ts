import { resolveDashboardPrimaryAction } from './dashboard-primary-action';

describe('resolveDashboardPrimaryAction', () => {
  it('should prioritise creating an account when none exist', () => {
    const action = resolveDashboardPrimaryAction({
      accountsLoading: false,
      accountsError: false,
      hasAccounts: false,
      transactionsLoading: false,
      transactionsLoadFailed: false,
      transactionCount: 0,
      schedulesLoading: false,
      schedulesLoadFailed: false,
      hasActiveScheduleOccurrenceToday: false,
    });

    expect(action?.label).toBe('Create account');
    expect(action?.route).toBe('/personal_finance/accounts');
  });

  it('should offer recording a transaction when history is empty', () => {
    const action = resolveDashboardPrimaryAction({
      accountsLoading: false,
      accountsError: false,
      hasAccounts: true,
      transactionsLoading: false,
      transactionsLoadFailed: false,
      transactionCount: 0,
      schedulesLoading: false,
      schedulesLoadFailed: false,
      hasActiveScheduleOccurrenceToday: false,
    });

    expect(action?.label).toBe('Record transaction');
  });

  it('should prioritise schedules when an occurrence is due today', () => {
    const action = resolveDashboardPrimaryAction({
      accountsLoading: false,
      accountsError: false,
      hasAccounts: true,
      transactionsLoading: false,
      transactionsLoadFailed: false,
      transactionCount: 3,
      schedulesLoading: false,
      schedulesLoadFailed: false,
      hasActiveScheduleOccurrenceToday: true,
    });

    expect(action?.label).toBe('Review schedules');
  });

  it('should not show a primary action while accounts are loading', () => {
    expect(
      resolveDashboardPrimaryAction({
        accountsLoading: true,
        accountsError: false,
        hasAccounts: true,
        transactionsLoading: false,
        transactionsLoadFailed: false,
        transactionCount: 5,
        schedulesLoading: false,
        schedulesLoadFailed: false,
        hasActiveScheduleOccurrenceToday: false,
      }),
    ).toBeNull();
  });

  it('should not show a primary action when accounts fail to load', () => {
    expect(
      resolveDashboardPrimaryAction({
        accountsLoading: false,
        accountsError: true,
        hasAccounts: true,
        transactionsLoading: false,
        transactionsLoadFailed: false,
        transactionCount: 5,
        schedulesLoading: false,
        schedulesLoadFailed: false,
        hasActiveScheduleOccurrenceToday: false,
      }),
    ).toBeNull();
  });

  it('should not treat a failed transaction load as an empty history', () => {
    expect(
      resolveDashboardPrimaryAction({
        accountsLoading: false,
        accountsError: false,
        hasAccounts: true,
        transactionsLoading: false,
        transactionsLoadFailed: true,
        transactionCount: null,
        schedulesLoading: false,
        schedulesLoadFailed: false,
        hasActiveScheduleOccurrenceToday: false,
      }),
    ).toBeNull();
  });

  it('should not offer schedule review when schedule loading failed', () => {
    const action = resolveDashboardPrimaryAction({
      accountsLoading: false,
      accountsError: false,
      hasAccounts: true,
      transactionsLoading: false,
      transactionsLoadFailed: false,
      transactionCount: 3,
      schedulesLoading: false,
      schedulesLoadFailed: true,
      hasActiveScheduleOccurrenceToday: true,
    });

    expect(action?.label).toBe('Record transaction');
  });
});
