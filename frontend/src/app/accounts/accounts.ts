import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { Account, AccountCreate, AccountType } from './account';
import { AccountService } from './account.service';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

const ACCOUNT_TYPES: AccountType[] = [
  'bank',
  'cash',
  'credit_card',
  'investment',
];

const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP'] as const;

const NAME_MAX_LENGTH = 100;

function parseOpeningBalance(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = (match[3] ?? '00').padEnd(2, '0');
  return sign * (whole + Number(fraction) / 100);
}

@Component({
  selector: 'app-accounts',
  imports: [CurrencyPipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts implements OnInit {
  readonly accountTypes = ACCOUNT_TYPES;
  readonly currencyOptions = CURRENCY_OPTIONS;

  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  accounts: Account[] = [];

  formOpen = false;
  saving = false;
  formName = '';
  formAccountType = '';
  formCurrency = 'EUR';
  formBalance = '0.00';
  formNameError: string | null = null;
  formTypeError: string | null = null;
  formBalanceError: string | null = null;
  formError: string | null = null;

  constructor(
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get canSubmit(): boolean {
    if (this.saving || !this.formOpen) {
      return false;
    }

    return this.buildPayload() !== null;
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  displayType(accountType: AccountType): string {
    return ACCOUNT_TYPE_LABELS[accountType];
  }

  startCreate(): void {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return;
    }

    this.formOpen = true;
    this.formName = '';
    this.formAccountType = '';
    this.formCurrency = 'EUR';
    this.formBalance = '0.00';
    this.clearFormMessages();
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  cancelForm(): void {
    if (this.saving) {
      return;
    }

    this.formOpen = false;
    this.clearFormMessages();
    this.changeDetector.detectChanges();
  }

  onFormTypeChange(value: string): void {
    this.formAccountType = value;
  }

  onFormCurrencyChange(value: string): void {
    this.formCurrency = value;
  }

  saveAccount(): void {
    if (this.saving || !this.formOpen) {
      return;
    }

    const payload = this.buildPayload(true);
    if (!payload) {
      this.changeDetector.detectChanges();
      return;
    }

    this.saving = true;
    this.formError = null;
    this.successMessage = null;

    this.accountService.createAccount(payload).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.clearFormMessages();
        this.successMessage = 'Account created.';
        this.changeDetector.markForCheck();
        this.loadAccounts({ keepSuccessMessage: true });
      },
      error: () => {
        this.saving = false;
        this.formError = 'Unable to create account.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private clearFormMessages(): void {
    this.formNameError = null;
    this.formTypeError = null;
    this.formBalanceError = null;
    this.formError = null;
  }

  private buildPayload(showErrors = false): AccountCreate | null {
    if (showErrors) {
      this.clearFormMessages();
    }

    const name = this.formName.trim();
    let valid = true;

    if (!name) {
      valid = false;
      if (showErrors) {
        this.formNameError = 'Enter an account name.';
      }
    } else if (name.length > NAME_MAX_LENGTH) {
      valid = false;
      if (showErrors) {
        this.formNameError = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
      }
    }

    const accountType = this.formAccountType as AccountType | '';
    if (
      accountType !== 'bank' &&
      accountType !== 'cash' &&
      accountType !== 'credit_card' &&
      accountType !== 'investment'
    ) {
      valid = false;
      if (showErrors) {
        this.formTypeError = 'Select an account type.';
      }
    }

    const balance = parseOpeningBalance(this.formBalance);
    if (balance === null) {
      valid = false;
      if (showErrors) {
        this.formBalanceError =
          'Enter a balance with at most two decimal places.';
      }
    }

    if (
      !valid ||
      balance === null ||
      accountType === ''
    ) {
      return null;
    }

    return {
      name,
      account_type: accountType,
      currency: this.formCurrency,
      current_balance: balance,
    };
  }

  private loadAccounts(options?: { keepSuccessMessage?: boolean }): void {
    this.loading = true;
    this.errorMessage = null;
    this.accounts = [];
    if (!options?.keepSuccessMessage) {
      this.successMessage = null;
    }

    this.accountService.listAccounts().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.accounts = [];
        this.errorMessage = 'Unable to load accounts.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
