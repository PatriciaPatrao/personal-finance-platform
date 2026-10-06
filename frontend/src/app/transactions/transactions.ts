import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import { Transaction, TransactionType } from './transactions-response';
import { TransactionService } from './transactions.service';

export const UNCATEGORIZED_FILTER = '__uncategorized__';

export type TransactionTypeFilter = 'all' | TransactionType;

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toEuropeanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

function parseEuropeanDate(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatDate(date);
}

@Component({
  selector: 'app-transactions',
  imports: [CurrencyPipe, DateField],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions implements OnInit {
  readonly uncategorizedFilter = UNCATEGORIZED_FILTER;

  fromDisplay = '';
  toDisplay = '';
  typeDraft: TransactionTypeFilter = 'all';
  categoryDraft = 'all';

  appliedFrom: string | null = null;
  appliedTo: string | null = null;
  appliedType: TransactionTypeFilter = 'all';
  appliedCategory = 'all';

  allTransactions: Transaction[] = [];
  private accountNames = new Map<number, string>();

  loading = true;
  loaded = false;
  errorMessage: string | null = null;
  validationMessage: string | null = null;

  constructor(
    private transactionService: TransactionService,
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get categoryOptions(): string[] {
    const categories = new Set<string>();
    for (const transaction of this.allTransactions) {
      const category = transaction.category?.trim();
      if (category) {
        categories.add(category);
      }
    }
    return [...categories].sort((left, right) => left.localeCompare(right));
  }

  get visibleTransactions(): Transaction[] {
    return this.allTransactions.filter((transaction) =>
      this.matchesFilters(transaction),
    );
  }

  get showRecordedEmpty(): boolean {
    return (
      this.loaded &&
      this.errorMessage === null &&
      this.allTransactions.length === 0
    );
  }

  get showFilterEmpty(): boolean {
    return (
      this.loaded &&
      this.errorMessage === null &&
      this.allTransactions.length > 0 &&
      this.visibleTransactions.length === 0
    );
  }

  ngOnInit(): void {
    this.loadTransactions();
  }

  apply(): void {
    const fromText = this.fromDisplay.trim();
    const toText = this.toDisplay.trim();

    let from: string | null = null;
    let to: string | null = null;

    if (fromText) {
      from = parseEuropeanDate(fromText);
      if (!from) {
        this.validationMessage = 'Enter dates as DD-MM-YYYY.';
        this.changeDetector.detectChanges();
        return;
      }
    }

    if (toText) {
      to = parseEuropeanDate(toText);
      if (!to) {
        this.validationMessage = 'Enter dates as DD-MM-YYYY.';
        this.changeDetector.detectChanges();
        return;
      }
    }

    if (from && to && from > to) {
      this.validationMessage = 'From must be on or before To.';
      this.changeDetector.detectChanges();
      return;
    }

    this.appliedFrom = from;
    this.appliedTo = to;
    this.appliedType = this.typeDraft;
    this.appliedCategory = this.categoryDraft;
    this.validationMessage = null;
    this.changeDetector.detectChanges();
  }

  onTypeChange(type: string): void {
    if (type !== 'all' && type !== 'income' && type !== 'expense') {
      return;
    }

    this.typeDraft = type;
  }

  onCategoryChange(category: string): void {
    this.categoryDraft = category;
  }

  trackTransaction(_index: number, transaction: Transaction): number {
    return transaction.id;
  }

  accountName(accountId: number): string {
    return this.accountNames.get(accountId) ?? `Account ${accountId}`;
  }

  displayText(value: string | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  displayDate(isoDate: string): string {
    return toEuropeanDate(isoDate);
  }

  displayType(type: TransactionType): string {
    return type === 'income' ? 'Income' : 'Expense';
  }

  private matchesFilters(transaction: Transaction): boolean {
    if (this.appliedFrom && transaction.occurred_on < this.appliedFrom) {
      return false;
    }

    if (this.appliedTo && transaction.occurred_on > this.appliedTo) {
      return false;
    }

    if (
      this.appliedType !== 'all' &&
      transaction.transaction_type !== this.appliedType
    ) {
      return false;
    }

    if (this.appliedCategory === UNCATEGORIZED_FILTER) {
      return !transaction.category?.trim();
    }

    if (this.appliedCategory !== 'all') {
      return transaction.category === this.appliedCategory;
    }

    return true;
  }

  private loadTransactions(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      transactions: this.transactionService.listTransactions(),
      accounts: this.accountService.listAccounts().pipe(
        catchError(() => of<Account[]>([])),
      ),
    }).subscribe({
      next: ({ transactions, accounts }) => {
        this.allTransactions = transactions;
        this.accountNames = new Map(
          accounts.map((account) => [account.id, account.name]),
        );
        this.loaded = true;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.allTransactions = [];
        this.accountNames = new Map();
        this.loaded = false;
        this.errorMessage = 'Unable to load transactions.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
