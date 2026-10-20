import { Account } from './account';
import {
  accountContextLabel,
  accountDisplayName,
  accountSelectOptionLabel,
  hasDuplicateAccountName,
} from './account-display';

const baseAccount: Account = {
  id: 1,
  name: 'Savings',
  account_type: 'bank',
  currency: 'EUR',
  current_balance: '100.00',
  created_at: '2026-01-15T10:00:00',
};

describe('account display helpers', () => {
  it('detects duplicate account names', () => {
    const accounts: Account[] = [
      baseAccount,
      { ...baseAccount, id: 2, currency: 'USD', created_at: '2026-03-01T00:00:00' },
    ];

    expect(hasDuplicateAccountName(baseAccount, accounts)).toBe(true);
  });

  it('adds created date to context when names collide', () => {
    const accounts: Account[] = [
      baseAccount,
      { ...baseAccount, id: 2, currency: 'USD' },
    ];

    expect(accountContextLabel(baseAccount, accounts)).toBe(
      'Bank · EUR · added 15-01-2026',
    );
  });

  it('uses type and currency without created date for unique names', () => {
    expect(accountContextLabel(baseAccount, [baseAccount])).toBe('Bank · EUR');
  });

  it('formats select labels with context', () => {
    expect(accountSelectOptionLabel(baseAccount, [baseAccount])).toBe(
      'Savings (Bank · EUR)',
    );
  });

  it('formats display names for transaction and schedule contexts', () => {
    const accounts: Account[] = [
      baseAccount,
      { ...baseAccount, id: 2, name: 'Main', currency: 'EUR' },
    ];

    expect(accountDisplayName(2, accounts)).toBe('Main · Bank · EUR');
  });
});
