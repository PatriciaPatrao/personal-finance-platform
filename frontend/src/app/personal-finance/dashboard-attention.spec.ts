import { Account } from '../accounts/account';
import { FinancialGoal } from '../goals/goal';
import {
  buildDashboardAttentionItems,
  goalProgressRatio,
  goalRemainingAmount,
} from './dashboard-attention';

describe('dashboard-attention', () => {
  const account: Account = {
    id: 1,
    name: 'Credit',
    account_type: 'credit_card',
    currency: 'EUR',
    current_balance: '-25.00',
    created_at: '2026-01-01T00:00:00',
  };

  it('should flag negative account balances', () => {
    const items = buildDashboardAttentionItems(
      [account],
      [],
      () => 'Account',
    );
    expect(items.some((item) => item.title.includes('negative balance'))).toBe(
      true,
    );
  });

  it('should not treat null goal progress as underfunded', () => {
    const goal: FinancialGoal = {
      id: 1,
      name: 'Holiday',
      target_amount: '1000.00',
      currency: 'USD',
      target_date: null,
      created_at: '2026-01-01T00:00:00',
      allocations: [],
      current_amount: null,
      progress: null,
      completed: null,
    };

    expect(goalProgressRatio(goal)).toBeNull();
    expect(goalRemainingAmount(goal)).toBeNull();
    const items = buildDashboardAttentionItems([], [goal], () => 'Account');
    expect(items).toEqual([]);
  });

  it('should calculate remaining amounts in the goal currency', () => {
    const goal: FinancialGoal = {
      id: 2,
      name: 'Emergency',
      target_amount: '1000.00',
      currency: 'GBP',
      target_date: null,
      created_at: '2026-01-01T00:00:00',
      allocations: [
        {
          id: 1,
          goal_id: 2,
          account_id: 1,
          amount: '400.00',
          funded_amount: '400.00',
          created_at: '2026-01-02T00:00:00',
        },
      ],
      current_amount: '400.00',
      progress: '0.4',
      completed: false,
    };

    expect(goalRemainingAmount(goal)).toBe('600.00');
  });
});
