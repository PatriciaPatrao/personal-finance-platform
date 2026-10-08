import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import { FinancialGoal, FinancialGoalWrite } from './goal';
import { GoalService } from './goal.service';

export type GoalFormMode = 'create' | 'edit';

const NAME_MAX_LENGTH = 100;
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP'] as const;

interface ApiValidationIssue {
  loc?: (string | number)[];
  msg?: string;
}

function normalizeTargetAmount(value: string): number | null {
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
  fallback = 'Unable to save the goal.',
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
    case 'name':
      return 'Name';
    case 'target_amount':
      return 'Target amount';
    case 'currency':
      return 'Currency';
    case 'target_date':
      return 'Target date';
    case 'account_id':
      return 'Account';
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

@Component({
  selector: 'app-goals',
  imports: [CurrencyPipe, DateField, NgTemplateOutlet],
  templateUrl: './goals.html',
  styleUrl: './goals.scss',
})
export class Goals implements OnInit {
  readonly currencyOptions = CURRENCY_OPTIONS;

  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  goals: FinancialGoal[] = [];
  accounts: Account[] = [];
  private accountNames = new Map<number, string>();
  accountsLoadFailed = false;

  formMode: GoalFormMode | null = null;
  editingId: number | null = null;
  saving = false;
  formName = '';
  formTargetAmount = '';
  formCurrency = 'EUR';
  formTargetDateDisplay = '';
  formAccountId = '';
  formNameError: string | null = null;
  formTargetAmountError: string | null = null;
  formTargetDateError: string | null = null;
  formError: string | null = null;

  constructor(
    private goalService: GoalService,
    private accountService: AccountService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get canSubmit(): boolean {
    if (this.saving || this.formMode === null) {
      return false;
    }

    return this.buildPayload() !== null;
  }

  get currencyLocked(): boolean {
    return this.formAccountId !== '';
  }

  get selectableAccounts(): Account[] {
    const occupied = new Set(
      this.goals
        .filter((goal) => goal.account_id !== null)
        .filter((goal) => goal.id !== this.editingId)
        .map((goal) => goal.account_id as number),
    );

    return this.accounts.filter((account) => !occupied.has(account.id));
  }

  ngOnInit(): void {
    this.loadPage();
  }

  accountIdValue(accountId: number): string {
    return String(accountId);
  }

  accountName(accountId: number | null): string {
    if (accountId === null) {
      return 'No account associated';
    }

    return this.accountNames.get(accountId) ?? `Account ${accountId}`;
  }

  selectedAccountCurrency(): string | null {
    if (!this.formAccountId) {
      return null;
    }

    const accountId = Number(this.formAccountId);
    const account = this.accounts.find((item) => item.id === accountId);
    return account?.currency ?? null;
  }

  displayTargetDate(isoDate: string | null): string {
    if (!isoDate) {
      return '—';
    }

    return toEuropeanDate(isoDate);
  }

  hasProgress(goal: FinancialGoal): boolean {
    return goal.progress !== null && goal.completed !== null;
  }

  progressPercent(goal: FinancialGoal): number {
    if (goal.progress === null) {
      return 0;
    }

    const value = Number(goal.progress) * 100;
    if (Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, value));
  }

  progressLabel(goal: FinancialGoal): string {
    return `${Math.round(this.progressPercent(goal))}%`;
  }

  isEditing(goal: FinancialGoal): boolean {
    return this.formMode === 'edit' && this.editingId === goal.id;
  }

  startCreate(): void {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return;
    }

    this.formMode = 'create';
    this.editingId = null;
    this.formName = '';
    this.formTargetAmount = '';
    this.formCurrency = 'EUR';
    this.formTargetDateDisplay = '';
    this.formAccountId = '';
    this.clearFieldErrors();
    this.formError = null;
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  startEdit(goal: FinancialGoal): void {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return;
    }

    this.formMode = 'edit';
    this.editingId = goal.id;
    this.formName = goal.name;
    this.formTargetAmount = goal.target_amount;
    this.formCurrency = goal.currency;
    this.formTargetDateDisplay = goal.target_date
      ? toEuropeanDate(goal.target_date)
      : '';
    this.formAccountId =
      goal.account_id === null ? '' : String(goal.account_id);
    this.clearFieldErrors();
    this.formError = null;
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  cancelForm(): void {
    if (this.saving) {
      return;
    }

    this.formMode = null;
    this.editingId = null;
    this.clearFieldErrors();
    this.formError = null;
    this.changeDetector.detectChanges();
  }

  onFormAccountChange(accountId: string): void {
    this.formAccountId = accountId;
    if (!accountId) {
      return;
    }

    const account = this.accounts.find(
      (item) => item.id === Number(accountId),
    );
    if (account) {
      this.formCurrency = account.currency;
    }
  }

  onFormCurrencyChange(currency: string): void {
    if (this.currencyLocked) {
      return;
    }

    this.formCurrency = currency;
  }

  saveGoal(): void {
    if (this.saving || this.formMode === null) {
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

    const editing = this.formMode === 'edit';
    const request =
      editing && this.editingId !== null
        ? this.goalService.updateGoal(this.editingId, payload)
        : this.goalService.createGoal(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.formMode = null;
        this.editingId = null;
        this.clearFieldErrors();
        this.formError = null;
        this.successMessage = editing
          ? 'Goal updated.'
          : 'Goal created.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = formatApiError(error);
        this.changeDetector.markForCheck();
      },
    });
  }

  private clearFieldErrors(): void {
    this.formNameError = null;
    this.formTargetAmountError = null;
    this.formTargetDateError = null;
  }

  private buildPayload(showErrors = false): FinancialGoalWrite | null {
    if (showErrors) {
      this.clearFieldErrors();
    }

    const name = this.formName.trim();
    let valid = true;

    if (!name) {
      valid = false;
      if (showErrors) {
        this.formNameError = 'Enter a goal name.';
      }
    } else if (name.length > NAME_MAX_LENGTH) {
      valid = false;
      if (showErrors) {
        this.formNameError =
          `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
      }
    }

    const targetAmount = normalizeTargetAmount(this.formTargetAmount);
    if (targetAmount === null) {
      valid = false;
      if (showErrors) {
        this.formTargetAmountError =
          'Enter a target amount greater than zero.';
      }
    }

    let targetDate: string | null = null;
    const dateDisplay = this.formTargetDateDisplay.trim();
    if (dateDisplay) {
      targetDate = parseEuropeanDate(dateDisplay);
      if (targetDate === null) {
        valid = false;
        if (showErrors) {
          this.formTargetDateError =
            'Enter a target date as DD-MM-YYYY.';
        }
      }
    }

    let accountId: number | null = null;
    if (this.formAccountId) {
      accountId = Number(this.formAccountId);
      const account = this.accounts.find((item) => item.id === accountId);
      if (!account || Number.isNaN(accountId)) {
        valid = false;
        if (showErrors) {
          this.formError = 'Select a valid account.';
        }
      } else if (account.currency !== this.formCurrency) {
        valid = false;
        if (showErrors) {
          this.formError =
            'Goal currency must match the selected account.';
        }
      }
    }

    if (!valid || targetAmount === null) {
      return null;
    }

    return {
      name,
      target_amount: targetAmount,
      currency: this.formCurrency,
      target_date: targetDate,
      account_id: accountId,
    };
  }

  private loadPage(options?: { keepSuccessMessage?: boolean }): void {
    this.loading = true;
    this.errorMessage = null;
    this.goals = [];
    this.accountsLoadFailed = false;
    if (!options?.keepSuccessMessage) {
      this.successMessage = null;
    }

    forkJoin({
      goals: this.goalService.listGoals(),
      accounts: this.accountService.listAccounts().pipe(
        catchError(() => {
          this.accountsLoadFailed = true;
          return of([] as Account[]);
        }),
      ),
    }).subscribe({
      next: ({ goals, accounts }) => {
        this.goals = goals;
        this.accounts = accounts;
        this.accountNames = new Map(
          accounts.map((account) => [account.id, account.name]),
        );
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.goals = [];
        this.errorMessage = 'Unable to load goals.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
