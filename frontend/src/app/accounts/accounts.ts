import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { Account, AccountType } from './account';
import { AccountService } from './account.service';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

@Component({
  selector: 'app-accounts',
  imports: [CurrencyPipe],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss',
})
export class Accounts implements OnInit {
  loading = true;
  errorMessage: string | null = null;
  accounts: Account[] = [];

  constructor(
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
  }

  displayType(accountType: AccountType): string {
    return ACCOUNT_TYPE_LABELS[accountType];
  }

  private loadAccounts(): void {
    this.loading = true;
    this.errorMessage = null;
    this.accounts = [];

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
