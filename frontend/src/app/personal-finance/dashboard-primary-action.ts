export type DashboardPrimaryAction = {
  label: string;
  route: string;
  description: string;
};

export function resolveDashboardPrimaryAction(input: {
  accountsLoading: boolean;
  accountsError: boolean;
  hasAccounts: boolean;
  transactionsLoading: boolean;
  transactionsLoadFailed: boolean;
  transactionCount: number | null;
  schedulesLoading: boolean;
  schedulesLoadFailed: boolean;
  hasActiveScheduleOccurrenceToday: boolean;
  hasActiveScheduleOccurrenceWithinSevenDays: boolean;
}): DashboardPrimaryAction | null {
  if (input.accountsLoading || input.accountsError) {
    return null;
  }

  if (!input.hasAccounts) {
    return {
      label: 'Create account',
      route: '/personal_finance/accounts',
      description:
        'Add an account to track stored balances and recorded transactions.',
    };
  }

  if (
    !input.transactionsLoading &&
    !input.transactionsLoadFailed &&
    input.transactionCount === 0
  ) {
    return {
      label: 'Record transaction',
      route: '/personal_finance/transactions',
      description:
        'Record your first income or expense to build transaction history.',
    };
  }

  if (
    !input.schedulesLoading &&
    !input.schedulesLoadFailed &&
    input.hasActiveScheduleOccurrenceToday
  ) {
    return {
      label: 'Review schedules',
      route: '/personal_finance/schedules',
      description:
        'An active schedule has an occurrence due today. Review or execute it on Schedules.',
    };
  }

  if (
    !input.schedulesLoading &&
    !input.schedulesLoadFailed &&
    input.hasActiveScheduleOccurrenceWithinSevenDays
  ) {
    return {
      label: 'Review schedules',
      route: '/personal_finance/schedules',
      description:
        'An active schedule has an upcoming occurrence within the next seven days.',
    };
  }

  if (input.transactionsLoading || input.transactionCount === null) {
    return null;
  }

  return {
    label: 'Record transaction',
    route: '/personal_finance/transactions',
    description: 'Record an income or expense on your accounts.',
  };
}
