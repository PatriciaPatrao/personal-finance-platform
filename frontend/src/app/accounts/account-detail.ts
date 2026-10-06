import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Account, accountTypeLabel } from './account';
import { AccountService } from './account.service';

function displayCreatedDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) {
    return createdAt;
  }

  return `${day}-${month}-${year}`;
}

@Component({
  selector: 'app-account-detail',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './account-detail.html',
  styleUrl: './account-detail.scss',
})
export class AccountDetail implements OnInit {
  loading = true;
  errorMessage: string | null = null;
  account: Account | null = null;

  constructor(
    private route: ActivatedRoute,
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const accountId = Number(rawId);

    if (
      rawId === null ||
      rawId.trim() === '' ||
      !Number.isInteger(accountId) ||
      accountId <= 0
    ) {
      this.loading = false;
      this.account = null;
      this.errorMessage = 'Unable to load this account.';
      this.changeDetector.markForCheck();
      return;
    }

    this.loadAccount(accountId);
  }

  displayType(account: Account): string {
    return accountTypeLabel(account.account_type);
  }

  displayCreatedAt(account: Account): string {
    return displayCreatedDate(account.created_at);
  }

  private loadAccount(accountId: number): void {
    this.loading = true;
    this.errorMessage = null;
    this.account = null;

    this.accountService.getAccount(accountId).subscribe({
      next: (account) => {
        this.account = account;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.account = null;
        this.errorMessage = 'Unable to load this account.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
