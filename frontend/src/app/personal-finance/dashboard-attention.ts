import { Account } from '../accounts/account';
import { FinancialGoal, GoalAllocation } from '../goals/goal';

export type DashboardAttentionItem = {
  id: string;
  title: string;
  detail: string;
  route: string;
};

function parseMoneyMinorUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = (match[3] ?? '00').padEnd(2, '0');
  return sign * (whole * 100n + BigInt(fraction));
}

function formatMoneyMinorUnits(minorUnits: bigint): string {
  const sign = minorUnits < 0n ? '-' : '';
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function negativeBalanceAccounts(
  accounts: Account[],
): Account[] {
  return accounts.filter(
    (account) =>
      parseMoneyMinorUnits(account.current_balance) < 0n,
  );
}

export function goalProgressRatio(goal: FinancialGoal): number | null {
  if (goal.progress === null) {
    return null;
  }

  const value = Number(goal.progress);
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function goalRemainingAmount(
  goal: FinancialGoal,
): string | null {
  if (goal.progress === null || goal.current_amount === null) {
    return null;
  }

  const target = parseMoneyMinorUnits(goal.target_amount);
  const current = parseMoneyMinorUnits(goal.current_amount);
  if (current >= target) {
    return null;
  }

  return formatMoneyMinorUnits(target - current);
}

export function underfundedAllocations(
  goal: FinancialGoal,
): GoalAllocation[] {
  return goal.allocations.filter(
    (allocation) =>
      parseMoneyMinorUnits(allocation.funded_amount) <
      parseMoneyMinorUnits(allocation.amount),
  );
}

export function buildDashboardAttentionItems(
  accounts: Account[],
  goals: FinancialGoal[],
  accountLabel: (accountId: number) => string,
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  for (const account of negativeBalanceAccounts(accounts)) {
    items.push({
      id: `negative-balance-${account.id}`,
      title: `${account.name} has a negative balance`,
      detail: `The stored balance for this ${account.currency} account is below zero.`,
      route: `/personal_finance/accounts/${account.id}`,
    });
  }

  for (const goal of goals) {
    const ratio = goalProgressRatio(goal);
    if (ratio !== null && ratio < 1) {
      const remaining = goalRemainingAmount(goal);
      items.push({
        id: `goal-below-target-${goal.id}`,
        title: `${goal.name} is below its target`,
        detail: remaining
          ? `${remaining} ${goal.currency} remains to reach the target amount.`
          : `Funded progress is below the target amount in ${goal.currency}.`,
        route: '/personal_finance/goals',
      });
    }

    for (const allocation of underfundedAllocations(goal)) {
      items.push({
        id: `allocation-underfunded-${allocation.id}`,
        title: `Designation not fully funded for ${goal.name}`,
        detail: `${accountLabel(allocation.account_id)} has ${allocation.funded_amount} ${goal.currency} funded of ${allocation.amount} ${goal.currency} designated.`,
        route: '/personal_finance/goals',
      });
    }
  }

  return items;
}
