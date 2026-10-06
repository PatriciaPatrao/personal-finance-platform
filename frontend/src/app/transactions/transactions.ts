import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import {
  Transaction,
  TransactionType,
  TransactionWrite,
} from './transactions-response';
import { TransactionService } from './transactions.service';

export const UNCATEGORIZED_FILTER = '__uncategorized__';

export type TransactionTypeFilter = 'all' | TransactionType;

export type TransactionFormMode = 'create' | 'edit';

const DESCRIPTION_MAX_LENGTH = 255;
const CATEGORY_MAX_LENGTH = 100;

interface ApiValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

function normalizeAmount(value: string): string | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const whole = match[1].replace(/^0+(?=\d)/, '');
  if (whole.length > 10) {
    return null;
  }

  const fraction = (match[2] ?? '00').padEnd(2, '0');
  if (whole === '0' && fraction === '00') {
    return null;
  }

  return `${whole}.${fraction}`;
}

function optionalText(
  value: string,
  maxLength: number,
): { value: string | null } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  if (trimmed.length > maxLength) {
    return {
      error: `must be ${maxLength} characters or fewer.`,
    };
  }

  return { value: trimmed };
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'account_id':
      return 'Account';
    case 'description':
      return 'Description';
    case 'amount':
      return 'Amount';
    case 'transaction_type':
      return 'Type';
    case 'occurred_on':
      return 'Date';
    case 'category':
      return 'Category';
    default:
      return field;
  }
}

function formatApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Unable to save the transaction.';
  }

  const detail = (error.error as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: ApiValidationIssue) => {
        const field = [...(item.loc ?? [])]
          .reverse()
          .find((part) => typeof part === 'string' && part !== 'body');
        const message = item.msg?.trim();
        if (!message) {
          return null;
        }

        return typeof field === 'string'
          ? `${fieldLabel(field)}: ${message}`
          : message;
      })
      .filter((message): message is string => message !== null);

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  return 'Unable to save the transaction.';
}

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
  accounts: Account[] = [];
  private accountNames = new Map<number, string>();
  accountsLoadFailed = false;

  loading = true;
  loaded = false;
  errorMessage: string | null = null;
  validationMessage: string | null = null;

  formMode: TransactionFormMode | null = null;
  editingId: number | null = null;
  formAccountId = '';
  formDescription = '';
  formAmount = '';
  formType: TransactionType = 'expense';
  formDateDisplay = '';
  formCategory = '';
  formError: string | null = null;
  saving = false;
  successMessage: string | null = null;

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

  get formTitle(): string {
    return this.formMode === 'edit' ? 'Edit transaction' : 'New transaction';
  }

  get accountChoices(): Account[] {
    const choices = [...this.accounts];
    const selectedId = Number(this.formAccountId);
    if (
      Number.isInteger(selectedId) &&
      selectedId > 0 &&
      !choices.some((account) => account.id === selectedId)
    ) {
      choices.push({
        id: selectedId,
        name: this.accountName(selectedId),
        account_type: 'bank',
        currency: 'EUR',
        current_balance: '0.00',
        created_at: '',
      });
    }

    return choices;
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

  startCreate(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.formAccountId = '';
    this.formDescription = '';
    this.formAmount = '';
    this.formType = 'expense';
    this.formDateDisplay = '';
    this.formCategory = '';
    this.formError = this.accountAvailabilityError();
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  startEdit(transaction: Transaction): void {
    this.formMode = 'edit';
    this.editingId = transaction.id;
    this.formAccountId = String(transaction.account_id);
    this.formDescription = transaction.description ?? '';
    this.formAmount = transaction.amount;
    this.formType = transaction.transaction_type;
    this.formDateDisplay = toEuropeanDate(transaction.occurred_on);
    this.formCategory = transaction.category ?? '';
    this.formError = this.accountAvailabilityError();
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  cancelForm(): void {
    this.formMode = null;
    this.editingId = null;
    this.formError = null;
    this.saving = false;
    this.changeDetector.detectChanges();
  }

  onFormTypeChange(type: string): void {
    if (type !== 'income' && type !== 'expense') {
      return;
    }

    this.formType = type;
  }

  onFormAccountChange(accountId: string): void {
    this.formAccountId = accountId;
  }

  saveTransaction(): void {
    if (this.saving || this.formMode === null) {
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      this.changeDetector.detectChanges();
      return;
    }

    this.saving = true;
    this.formError = null;
    this.successMessage = null;

    const request =
      this.formMode === 'edit' && this.editingId !== null
        ? this.transactionService.updateTransaction(this.editingId, payload)
        : this.transactionService.createTransaction(payload);
    const editing = this.formMode === 'edit';

    request.subscribe({
      next: (transaction: Transaction) => {
        this.upsertTransaction(transaction);
        this.formMode = null;
        this.editingId = null;
        this.saving = false;
        this.formError = null;
        this.successMessage = editing
          ? 'Transaction updated.'
          : 'Transaction recorded.';
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = formatApiError(error);
        this.changeDetector.markForCheck();
      },
    });
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

  private accountAvailabilityError(): string | null {
    if (this.accountsLoadFailed) {
      return 'Unable to load accounts.';
    }

    if (this.accounts.length === 0) {
      return 'No accounts are available.';
    }

    return null;
  }

  private buildPayload(): TransactionWrite | null {
    const availabilityError = this.accountAvailabilityError();
    if (availabilityError) {
      this.formError = availabilityError;
      return null;
    }

    const accountId = Number(this.formAccountId);
    if (
      !Number.isInteger(accountId) ||
      !this.accounts.some((account) => account.id === accountId)
    ) {
      this.formError = 'Select an account.';
      return null;
    }

    const occurredOn = parseEuropeanDate(this.formDateDisplay);
    if (!occurredOn) {
      this.formError = 'Enter the date as DD-MM-YYYY.';
      return null;
    }

    const amount = normalizeAmount(this.formAmount);
    if (!amount) {
      this.formError = 'Enter a positive amount with at most two decimal places.';
      return null;
    }

    if (this.formType !== 'income' && this.formType !== 'expense') {
      this.formError = 'Select income or expense.';
      return null;
    }

    const description = optionalText(
      this.formDescription,
      DESCRIPTION_MAX_LENGTH,
    );
    if ('error' in description) {
      this.formError = `Description ${description.error}`;
      return null;
    }

    const category = optionalText(this.formCategory, CATEGORY_MAX_LENGTH);
    if ('error' in category) {
      this.formError = `Category ${category.error}`;
      return null;
    }

    this.formError = null;
    return {
      account_id: accountId,
      description: description.value,
      amount,
      transaction_type: this.formType,
      occurred_on: occurredOn,
      category: category.value,
    };
  }

  private upsertTransaction(transaction: Transaction): void {
    const remaining = this.allTransactions.filter(
      (item) => item.id !== transaction.id,
    );
    this.allTransactions = [...remaining, transaction].sort((left, right) => {
      if (left.occurred_on !== right.occurred_on) {
        return right.occurred_on.localeCompare(left.occurred_on);
      }

      return right.id - left.id;
    });
    this.loaded = true;
    this.errorMessage = null;
  }

  private loadTransactions(): void {
    this.loading = true;
    this.errorMessage = null;
    this.accountsLoadFailed = false;

    forkJoin({
      transactions: this.transactionService.listTransactions(),
      accounts: this.accountService.listAccounts().pipe(
        catchError(() => {
          this.accountsLoadFailed = true;
          return of<Account[]>([]);
        }),
      ),
    }).subscribe({
      next: ({ transactions, accounts }) => {
        this.allTransactions = transactions;
        this.accounts = accounts;
        this.accountNames = new Map(
          accounts.map((account) => [account.id, account.name]),
        );
        this.loaded = true;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.allTransactions = [];
        this.accounts = [];
        this.accountNames = new Map();
        this.loaded = false;
        this.errorMessage = 'Unable to load transactions.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
