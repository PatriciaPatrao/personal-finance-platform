import { Account } from '../accounts/account';
import { accountDisplayName } from '../accounts/account-display';
import { Income } from '../schedules/income';
import { RecurringExpense } from '../schedules/recurring-expense';

export type UpcomingCommitmentKind = 'income' | 'expense';

export interface UpcomingCommitment {
  key: string;
  kind: UpcomingCommitmentKind;
  scheduleId: number;
  occurrenceDate: string;
  description: string;
  amount: string;
  currency: string;
  accountId: number;
  accountLabel: string;
}

export interface UpcomingCommitmentsInput {
  windowFrom: string;
  windowTo: string;
  incomes: Income[];
  expenses: RecurringExpense[];
  accounts: Account[];
}

function accountContext(
  accountId: number,
  accounts: Account[],
): { currency: string; label: string } | null {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    return null;
  }

  return {
    currency: account.currency,
    label: accountDisplayName(accountId, accounts),
  };
}

function scheduleEligible(
  active: boolean,
  nextOccurrence: string,
  startDate: string,
  endDate: string | null,
  windowFrom: string,
  windowTo: string,
): boolean {
  if (!active) {
    return false;
  }

  if (nextOccurrence < windowFrom || nextOccurrence > windowTo) {
    return false;
  }

  if (nextOccurrence < startDate) {
    return false;
  }

  if (endDate !== null && nextOccurrence > endDate) {
    return false;
  }

  return true;
}

export function buildUpcomingCommitments(
  input: UpcomingCommitmentsInput,
): UpcomingCommitment[] {
  const commitments: UpcomingCommitment[] = [];

  for (const income of input.incomes) {
    if (
      !scheduleEligible(
        income.active,
        income.next_occurrence,
        income.start_date,
        income.end_date,
        input.windowFrom,
        input.windowTo,
      )
    ) {
      continue;
    }

    const account = accountContext(income.account_id, input.accounts);
    if (!account) {
      continue;
    }

    commitments.push({
      key: `income-${income.id}`,
      kind: 'income',
      scheduleId: income.id,
      occurrenceDate: income.next_occurrence,
      description: 'Salary',
      amount: income.amount,
      currency: account.currency,
      accountId: income.account_id,
      accountLabel: account.label,
    });
  }

  for (const expense of input.expenses) {
    if (
      !scheduleEligible(
        expense.active,
        expense.next_occurrence,
        expense.start_date,
        expense.end_date,
        input.windowFrom,
        input.windowTo,
      )
    ) {
      continue;
    }

    const account = accountContext(expense.account_id, input.accounts);
    if (!account) {
      continue;
    }

    commitments.push({
      key: `expense-${expense.id}`,
      kind: 'expense',
      scheduleId: expense.id,
      occurrenceDate: expense.next_occurrence,
      description: expense.description,
      amount: expense.amount,
      currency: account.currency,
      accountId: expense.account_id,
      accountLabel: account.label,
    });
  }

  commitments.sort((left, right) => {
    const byDate = left.occurrenceDate.localeCompare(right.occurrenceDate);
    if (byDate !== 0) {
      return byDate;
    }

    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) {
      return byKind;
    }

    return left.scheduleId - right.scheduleId;
  });

  return commitments;
}

export function addIsoDays(isoDate: string, dayCount: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayCount);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/** Active schedules with next_occurrence after fromDate through fromDate + dayCount (ISO). */
export function hasActiveScheduleOccurrenceWithinDays(
  incomes: Income[],
  expenses: RecurringExpense[],
  fromDate: string,
  dayCount: number,
): boolean {
  const throughDate = addIsoDays(fromDate, dayCount);

  const inWindow = (nextOccurrence: string, active: boolean): boolean => {
    if (!active) {
      return false;
    }

    return nextOccurrence > fromDate && nextOccurrence <= throughDate;
  };

  return (
    incomes.some((item) => inWindow(item.next_occurrence, item.active)) ||
    expenses.some((item) => inWindow(item.next_occurrence, item.active))
  );
}

export function groupUpcomingByCurrency(
  commitments: UpcomingCommitment[],
): { currency: string; items: UpcomingCommitment[] }[] {
  const order: string[] = [];
  const groups = new Map<string, UpcomingCommitment[]>();

  for (const item of commitments) {
    const existing = groups.get(item.currency);
    if (existing) {
      existing.push(item);
    } else {
      order.push(item.currency);
      groups.set(item.currency, [item]);
    }
  }

  return [...order]
    .sort((left, right) => left.localeCompare(right))
    .map((currency) => ({
      currency,
      items: groups.get(currency) ?? [],
    }));
}
