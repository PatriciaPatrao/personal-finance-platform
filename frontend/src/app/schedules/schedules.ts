import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import { Income, IncomeWrite, ScheduleFrequency } from './income';
import { IncomeService } from './income.service';
import {
  RecurringExpense,
  RecurringExpenseWrite,
} from './recurring-expense';
import { RecurringExpenseService } from './recurring-expense.service';

export type ScheduleFormKind = 'income' | 'expense';
export type ScheduleFormMode = 'create' | 'edit';
export type ActiveFilter = 'all' | 'active' | 'inactive';

const DESCRIPTION_MAX_LENGTH = 255;
const CATEGORY_MAX_LENGTH = 100;
const FREQUENCY_OPTIONS: ScheduleFrequency[] = [
  'weekly',
  'monthly',
  'yearly',
];

interface ApiValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

function normalizePositiveAmount(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const whole = match[1].replace(/^0+(?=\d)/, '') || '0';
  if (whole.length > 10) {
    return null;
  }

  const fraction = (match[2] ?? '00').padEnd(2, '0');
  if (whole === '0' && fraction === '00') {
    return null;
  }

  return Number(`${whole}.${fraction}`);
}

function formatApiError(
  error: unknown,
  fallback = 'Unable to save the schedule.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
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

  return fallback;
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'account_id':
      return 'Account';
    case 'description':
      return 'Description';
    case 'amount':
      return 'Amount';
    case 'category':
      return 'Category';
    case 'frequency':
      return 'Frequency';
    case 'start_date':
      return 'Start date';
    case 'next_occurrence':
      return 'Next occurrence';
    case 'end_date':
      return 'End date';
    case 'active':
      return 'Active';
    default:
      return field;
  }
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

  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

function frequencyLabel(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
  }
}

@Component({
  selector: 'app-schedules',
  imports: [CurrencyPipe, DateField, NgTemplateOutlet],
  templateUrl: './schedules.html',
  styleUrl: './schedules.scss',
})
export class Schedules implements OnInit {
  readonly frequencyOptions = FREQUENCY_OPTIONS;

  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  incomes: Income[] = [];
  expenses: RecurringExpense[] = [];
  accounts: Account[] = [];
  private accountNames = new Map<number, string>();
  private accountCurrencies = new Map<number, string>();
  accountsLoadFailed = false;

  incomeFilter: ActiveFilter = 'all';
  expenseFilter: ActiveFilter = 'all';

  formKind: ScheduleFormKind | null = null;
  formMode: ScheduleFormMode | null = null;
  editingId: number | null = null;
  saving = false;

  formAccountId = '';
  formDescription = '';
  formAmount = '';
  formCategory = '';
  formFrequency: ScheduleFrequency = 'monthly';
  formStartDateDisplay = '';
  formNextOccurrenceDisplay = '';
  formEndDateDisplay = '';
  formActive = true;

  formAccountError: string | null = null;
  formDescriptionError: string | null = null;
  formAmountError: string | null = null;
  formCategoryError: string | null = null;
  formStartDateError: string | null = null;
  formNextOccurrenceError: string | null = null;
  formEndDateError: string | null = null;
  formError: string | null = null;

  constructor(
    private incomeService: IncomeService,
    private recurringExpenseService: RecurringExpenseService,
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get canSubmit(): boolean {
    if (this.saving || this.formKind === null || this.formMode === null) {
      return false;
    }

    if (this.formKind === 'income') {
      return this.buildIncomePayload() !== null;
    }

    return this.buildExpensePayload() !== null;
  }

  get hasAccounts(): boolean {
    return this.accounts.length > 0;
  }

  get filteredIncomes(): Income[] {
    return this.filterByActive(this.incomes, this.incomeFilter);
  }

  get filteredExpenses(): RecurringExpense[] {
    return this.filterByActive(this.expenses, this.expenseFilter);
  }

  ngOnInit(): void {
    this.loadPage();
  }

  accountIdValue(accountId: number): string {
    return String(accountId);
  }

  accountName(accountId: number): string {
    return this.accountNames.get(accountId) ?? `Account ${accountId}`;
  }

  accountCurrency(accountId: number): string {
    return this.accountCurrencies.get(accountId) ?? 'EUR';
  }

  displayDate(isoDate: string | null): string {
    if (!isoDate) {
      return '—';
    }

    return toEuropeanDate(isoDate);
  }

  frequencyLabel(frequency: ScheduleFrequency): string {
    return frequencyLabel(frequency);
  }

  isEditingIncome(income: Income): boolean {
    return (
      this.formKind === 'income' &&
      this.formMode === 'edit' &&
      this.editingId === income.id
    );
  }

  isEditingExpense(expense: RecurringExpense): boolean {
    return (
      this.formKind === 'expense' &&
      this.formMode === 'edit' &&
      this.editingId === expense.id
    );
  }

  onIncomeFilterChange(value: string): void {
    this.incomeFilter = value as ActiveFilter;
  }

  onExpenseFilterChange(value: string): void {
    this.expenseFilter = value as ActiveFilter;
  }

  startCreateIncome(): void {
    if (!this.canOpenForm()) {
      return;
    }

    this.resetFormState('income', 'create', null);
    this.formActive = true;
    this.changeDetector.detectChanges();
  }

  startCreateExpense(): void {
    if (!this.canOpenForm()) {
      return;
    }

    this.resetFormState('expense', 'create', null);
    this.formActive = true;
    this.changeDetector.detectChanges();
  }

  startEditIncome(income: Income): void {
    if (!this.canOpenForm()) {
      return;
    }

    this.resetFormState('income', 'edit', income.id);
    this.formAccountId = String(income.account_id);
    this.formAmount = String(income.amount);
    this.formFrequency = income.frequency;
    this.formStartDateDisplay = toEuropeanDate(income.start_date);
    this.formNextOccurrenceDisplay = toEuropeanDate(income.next_occurrence);
    this.formEndDateDisplay = income.end_date
      ? toEuropeanDate(income.end_date)
      : '';
    this.formActive = income.active;
    this.changeDetector.detectChanges();
  }

  startEditExpense(expense: RecurringExpense): void {
    if (!this.canOpenForm()) {
      return;
    }

    this.resetFormState('expense', 'edit', expense.id);
    this.formAccountId = String(expense.account_id);
    this.formDescription = expense.description;
    this.formAmount = String(expense.amount);
    this.formCategory = expense.category ?? '';
    this.formFrequency = expense.frequency;
    this.formStartDateDisplay = toEuropeanDate(expense.start_date);
    this.formNextOccurrenceDisplay = toEuropeanDate(
      expense.next_occurrence,
    );
    this.formEndDateDisplay = expense.end_date
      ? toEuropeanDate(expense.end_date)
      : '';
    this.formActive = expense.active;
    this.changeDetector.detectChanges();
  }

  cancelForm(): void {
    if (this.saving) {
      return;
    }

    this.formKind = null;
    this.formMode = null;
    this.editingId = null;
    this.clearFieldErrors();
    this.formError = null;
    this.changeDetector.detectChanges();
  }

  onFormAccountChange(accountId: string): void {
    this.formAccountId = accountId;
    this.formAccountError = null;
  }

  onFormFrequencyChange(frequency: string): void {
    this.formFrequency = frequency as ScheduleFrequency;
  }

  onFormActiveChange(checked: boolean): void {
    this.formActive = checked;
  }

  deactivateIncome(income: Income): void {
    if (this.saving || this.loading || this.errorMessage !== null) {
      return;
    }

    const payload: IncomeWrite = {
      account_id: income.account_id,
      amount: Number(income.amount),
      frequency: income.frequency,
      start_date: income.start_date,
      next_occurrence: income.next_occurrence,
      end_date: income.end_date,
      active: false,
    };

    this.saving = true;
    this.successMessage = null;
    this.incomeService.updateIncome(income.id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.formKind = null;
        this.formMode = null;
        this.editingId = null;
        this.successMessage = 'Salary schedule deactivated.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = formatApiError(
          error,
          'Unable to deactivate the salary schedule.',
        );
        this.changeDetector.markForCheck();
      },
    });
  }

  deactivateExpense(expense: RecurringExpense): void {
    if (this.saving || this.loading || this.errorMessage !== null) {
      return;
    }

    const payload: RecurringExpenseWrite = {
      account_id: expense.account_id,
      description: expense.description,
      amount: Number(expense.amount),
      category: expense.category,
      frequency: expense.frequency,
      start_date: expense.start_date,
      next_occurrence: expense.next_occurrence,
      end_date: expense.end_date,
      active: false,
    };

    this.saving = true;
    this.successMessage = null;
    this.recurringExpenseService
      .updateRecurringExpense(expense.id, payload)
      .subscribe({
        next: () => {
          this.saving = false;
          this.formKind = null;
          this.formMode = null;
          this.editingId = null;
          this.successMessage = 'Recurring expense deactivated.';
          this.changeDetector.markForCheck();
          this.loadPage({ keepSuccessMessage: true });
        },
        error: (error: unknown) => {
          this.saving = false;
          this.formError = formatApiError(
            error,
            'Unable to deactivate the recurring expense.',
          );
          this.changeDetector.markForCheck();
        },
      });
  }

  saveSchedule(): void {
    if (this.saving || this.formKind === null || this.formMode === null) {
      return;
    }

    if (this.formKind === 'income') {
      this.saveIncome();
      return;
    }

    this.saveExpense();
  }

  private saveIncome(): void {
    const payload = this.buildIncomePayload(true);
    if (!payload) {
      this.changeDetector.detectChanges();
      return;
    }

    this.saving = true;
    this.formError = null;
    this.successMessage = null;

    const editing = this.formMode === 'edit';
    const request =
      editing && this.editingId !== null
        ? this.incomeService.updateIncome(this.editingId, payload)
        : this.incomeService.createIncome(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.formKind = null;
        this.formMode = null;
        this.editingId = null;
        this.clearFieldErrors();
        this.formError = null;
        this.successMessage = editing
          ? 'Salary schedule updated.'
          : 'Salary schedule created.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = formatApiError(
          error,
          'Unable to save the salary schedule.',
        );
        this.changeDetector.markForCheck();
      },
    });
  }

  private saveExpense(): void {
    const payload = this.buildExpensePayload(true);
    if (!payload) {
      this.changeDetector.detectChanges();
      return;
    }

    this.saving = true;
    this.formError = null;
    this.successMessage = null;

    const editing = this.formMode === 'edit';
    const request =
      editing && this.editingId !== null
        ? this.recurringExpenseService.updateRecurringExpense(
            this.editingId,
            payload,
          )
        : this.recurringExpenseService.createRecurringExpense(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.formKind = null;
        this.formMode = null;
        this.editingId = null;
        this.clearFieldErrors();
        this.formError = null;
        this.successMessage = editing
          ? 'Recurring expense updated.'
          : 'Recurring expense created.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = formatApiError(
          error,
          'Unable to save the recurring expense.',
        );
        this.changeDetector.markForCheck();
      },
    });
  }

  private canOpenForm(): boolean {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return false;
    }

    if (this.accountsLoadFailed) {
      this.formError = 'Unable to load accounts for the schedule form.';
      this.changeDetector.detectChanges();
      return false;
    }

    if (!this.hasAccounts) {
      this.formError =
        'Create an account before adding a salary or recurring expense.';
      this.changeDetector.detectChanges();
      return false;
    }

    return true;
  }

  private resetFormState(
    kind: ScheduleFormKind,
    mode: ScheduleFormMode,
    editingId: number | null,
  ): void {
    this.formKind = kind;
    this.formMode = mode;
    this.editingId = editingId;
    this.formAccountId = '';
    this.formDescription = '';
    this.formAmount = '';
    this.formCategory = '';
    this.formFrequency = 'monthly';
    this.formStartDateDisplay = '';
    this.formNextOccurrenceDisplay = '';
    this.formEndDateDisplay = '';
    this.formActive = true;
    this.clearFieldErrors();
    this.formError = null;
    this.successMessage = null;
  }

  private clearFieldErrors(): void {
    this.formAccountError = null;
    this.formDescriptionError = null;
    this.formAmountError = null;
    this.formCategoryError = null;
    this.formStartDateError = null;
    this.formNextOccurrenceError = null;
    this.formEndDateError = null;
  }

  private filterByActive<T extends { active: boolean }>(
    items: T[],
    filter: ActiveFilter,
  ): T[] {
    if (filter === 'active') {
      return items.filter((item) => item.active);
    }

    if (filter === 'inactive') {
      return items.filter((item) => !item.active);
    }

    return items;
  }

  private buildIncomePayload(showErrors = false): IncomeWrite | null {
    if (showErrors) {
      this.clearFieldErrors();
    }

    const shared = this.buildSharedScheduleFields(showErrors);
    if (!shared) {
      return null;
    }

    return {
      account_id: shared.accountId,
      amount: shared.amount,
      frequency: this.formFrequency,
      start_date: shared.startDate,
      next_occurrence: shared.nextOccurrence,
      end_date: shared.endDate,
      active: this.formActive,
    };
  }

  private buildExpensePayload(
    showErrors = false,
  ): RecurringExpenseWrite | null {
    if (showErrors) {
      this.clearFieldErrors();
    }

    let valid = true;
    const description = this.formDescription.trim();
    if (!description) {
      valid = false;
      if (showErrors) {
        this.formDescriptionError = 'Enter a description.';
      }
    } else if (description.length > DESCRIPTION_MAX_LENGTH) {
      valid = false;
      if (showErrors) {
        this.formDescriptionError =
          `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
      }
    }

    const categoryTrimmed = this.formCategory.trim();
    let category: string | null = null;
    if (categoryTrimmed) {
      if (categoryTrimmed.length > CATEGORY_MAX_LENGTH) {
        valid = false;
        if (showErrors) {
          this.formCategoryError =
            `Category must be ${CATEGORY_MAX_LENGTH} characters or fewer.`;
        }
      } else {
        category = categoryTrimmed;
      }
    }

    const shared = this.buildSharedScheduleFields(showErrors);
    if (!valid || !shared) {
      return null;
    }

    return {
      account_id: shared.accountId,
      description,
      amount: shared.amount,
      category,
      frequency: this.formFrequency,
      start_date: shared.startDate,
      next_occurrence: shared.nextOccurrence,
      end_date: shared.endDate,
      active: this.formActive,
    };
  }

  private buildSharedScheduleFields(showErrors: boolean): {
    accountId: number;
    amount: number;
    startDate: string;
    nextOccurrence: string;
    endDate: string | null;
  } | null {
    let valid = true;

    if (!this.formAccountId) {
      valid = false;
      if (showErrors) {
        this.formAccountError = 'Select an account.';
      }
    }

    const accountId = Number(this.formAccountId);
    if (this.formAccountId && Number.isNaN(accountId)) {
      valid = false;
      if (showErrors) {
        this.formAccountError = 'Select an account.';
      }
    }

    const amount = normalizePositiveAmount(this.formAmount);
    if (amount === null) {
      valid = false;
      if (showErrors) {
        this.formAmountError = 'Enter an amount greater than zero.';
      }
    }

    const startDate = parseEuropeanDate(this.formStartDateDisplay);
    if (!this.formStartDateDisplay.trim()) {
      valid = false;
      if (showErrors) {
        this.formStartDateError = 'Enter a start date as DD-MM-YYYY.';
      }
    } else if (startDate === null) {
      valid = false;
      if (showErrors) {
        this.formStartDateError = 'Enter a start date as DD-MM-YYYY.';
      }
    }

    const nextOccurrence = parseEuropeanDate(
      this.formNextOccurrenceDisplay,
    );
    if (!this.formNextOccurrenceDisplay.trim()) {
      valid = false;
      if (showErrors) {
        this.formNextOccurrenceError =
          'Enter a next occurrence as DD-MM-YYYY.';
      }
    } else if (nextOccurrence === null) {
      valid = false;
      if (showErrors) {
        this.formNextOccurrenceError =
          'Enter a next occurrence as DD-MM-YYYY.';
      }
    }

    let endDate: string | null = null;
    const endDisplay = this.formEndDateDisplay.trim();
    if (endDisplay) {
      endDate = parseEuropeanDate(endDisplay);
      if (endDate === null) {
        valid = false;
        if (showErrors) {
          this.formEndDateError = 'Enter an end date as DD-MM-YYYY.';
        }
      }
    }

    if (
      startDate !== null &&
      nextOccurrence !== null &&
      startDate > nextOccurrence
    ) {
      valid = false;
      if (showErrors) {
        this.formStartDateError =
          'Start date must be on or before next occurrence.';
      }
    }

    if (startDate !== null && endDate !== null && startDate > endDate) {
      valid = false;
      if (showErrors) {
        this.formEndDateError =
          'Start date must be on or before end date.';
      }
    }

    if (
      nextOccurrence !== null &&
      endDate !== null &&
      nextOccurrence > endDate
    ) {
      valid = false;
      if (showErrors) {
        this.formEndDateError =
          'Next occurrence must be on or before end date.';
      }
    }

    if (
      !valid ||
      amount === null ||
      startDate === null ||
      nextOccurrence === null ||
      Number.isNaN(accountId)
    ) {
      return null;
    }

    return {
      accountId,
      amount,
      startDate,
      nextOccurrence,
      endDate,
    };
  }

  private loadPage(options?: { keepSuccessMessage?: boolean }): void {
    this.loading = true;
    this.errorMessage = null;
    this.incomes = [];
    this.expenses = [];
    this.accountsLoadFailed = false;
    if (!options?.keepSuccessMessage) {
      this.successMessage = null;
    }

    forkJoin({
      incomes: this.incomeService.listIncomes(),
      expenses: this.recurringExpenseService.listRecurringExpenses(),
      accounts: this.accountService.listAccounts().pipe(
        catchError(() => {
          this.accountsLoadFailed = true;
          return of([] as Account[]);
        }),
      ),
    }).subscribe({
      next: ({ incomes, expenses, accounts }) => {
        this.incomes = incomes;
        this.expenses = expenses;
        this.accounts = accounts;
        this.accountNames = new Map(
          accounts.map((account) => [account.id, account.name]),
        );
        this.accountCurrencies = new Map(
          accounts.map((account) => [account.id, account.currency]),
        );
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.incomes = [];
        this.expenses = [];
        this.errorMessage = 'Unable to load schedules.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
