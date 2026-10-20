import { Account, accountTypeLabel } from './account';

export function accountCreatedDateLabel(account: Account): string {
  const datePart = account.created_at.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}-${month}-${year}`;
}

export function hasDuplicateAccountName(
  account: Account,
  accounts: Account[],
): boolean {
  return accounts.filter((item) => item.name === account.name).length > 1;
}

export function accountContextLabel(
  account: Account,
  accounts: Account[],
): string {
  const parts = [accountTypeLabel(account.account_type), account.currency];
  if (hasDuplicateAccountName(account, accounts)) {
    parts.push(`added ${accountCreatedDateLabel(account)}`);
  }
  return parts.join(' · ');
}

export function accountSelectOptionLabel(
  account: Account,
  accounts: Account[],
): string {
  return `${account.name} (${accountContextLabel(account, accounts)})`;
}

export function accountById(
  accounts: Account[],
  accountId: number,
): Account | undefined {
  return accounts.find((account) => account.id === accountId);
}

export function accountDisplayName(
  accountId: number,
  accounts: Account[],
): string {
  const account = accountById(accounts, accountId);
  if (!account) {
    return `Account ${accountId}`;
  }

  if (accounts.length === 0) {
    return account.name;
  }

  return `${account.name} · ${accountContextLabel(account, accounts)}`;
}
