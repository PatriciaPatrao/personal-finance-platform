import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import {
  FinancialGoal,
  FinancialGoalWrite,
  GoalAllocation,
} from './goal';
import { GoalService } from './goal.service';

export type GoalFormMode = 'create' | 'edit';

const NAME_MAX_LENGTH = 100;
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP'] as const;

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
    case 'amount':
      return 'Amount';
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
  formNameError: string | null = null;
  formTargetAmountError: string | null = null;
  formTargetDateError: string | null = null;
  formError: string | null = null;

  allocatingGoalId: number | null = null;
  allocateAccountId = '';
  allocateAmount = '';
  allocateAmountError: string | null = null;
  allocateError: string | null = null;
  allocating = false;

  reducingAllocationId: number | null = null;
  reduceAmount = '';
  reduceAmountError: string | null = null;
  reduceError: string | null = null;

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
    if (this.formMode !== 'edit' || this.editingId === null) {
      return false;
    }

    const goal = this.goals.find((item) => item.id === this.editingId);
    return (goal?.allocations.length ?? 0) > 0;
  }

  get canSubmitAllocation(): boolean {
    if (this.allocating || this.allocatingGoalId === null) {
      return false;
    }

    return this.buildAllocationAmount() !== null;
  }

  ngOnInit(): void {
    this.loadPage();
  }

  accountIdValue(accountId: number): string {
    return String(accountId);
  }

  selectedAllocateAccountId(): number | null {
    if (!this.allocateAccountId) {
      return null;
    }

    const accountId = Number(this.allocateAccountId);
    return Number.isNaN(accountId) ? null : accountId;
  }

  accountName(accountId: number): string {
    return this.accountNames.get(accountId) ?? `Account ${accountId}`;
  }

  accountBalance(accountId: number): string | null {
    return (
      this.accounts.find((account) => account.id === accountId)
        ?.current_balance ?? null
    );
  }

  designatedOnAccount(accountId: number): number {
    let total = 0;
    for (const goal of this.goals) {
      for (const allocation of goal.allocations) {
        if (allocation.account_id === accountId) {
          total += Number(allocation.amount);
        }
      }
    }
    return total;
  }

  availableOnAccount(accountId: number): number {
    const account = this.accounts.find((item) => item.id === accountId);
    if (!account) {
      return 0;
    }

    const balance = Number(account.current_balance);
    const capacity = Number.isNaN(balance) ? 0 : Math.max(0, balance);
    return Math.max(0, capacity - this.designatedOnAccount(accountId));
  }

  compatibleAccounts(goal: FinancialGoal): Account[] {
    return this.accounts.filter(
      (account) => account.currency === goal.currency,
    );
  }

  allocationForAccount(
    goal: FinancialGoal,
    accountId: number,
  ): GoalAllocation | undefined {
    return goal.allocations.find(
      (allocation) => allocation.account_id === accountId,
    );
  }

  isUnderfunded(allocation: GoalAllocation): boolean {
    return Number(allocation.funded_amount) < Number(allocation.amount);
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

  isAllocating(goal: FinancialGoal): boolean {
    return this.allocatingGoalId === goal.id;
  }

  isReducing(allocation: GoalAllocation): boolean {
    return this.reducingAllocationId === allocation.id;
  }

  startCreate(): void {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return;
    }

    this.closeAllocationPanels();
    this.formMode = 'create';
    this.editingId = null;
    this.formName = '';
    this.formTargetAmount = '';
    this.formCurrency = 'EUR';
    this.formTargetDateDisplay = '';
    this.clearFieldErrors();
    this.formError = null;
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  startEdit(goal: FinancialGoal): void {
    if (this.loading || this.errorMessage !== null || this.saving) {
      return;
    }

    this.closeAllocationPanels();
    this.formMode = 'edit';
    this.editingId = goal.id;
    this.formName = goal.name;
    this.formTargetAmount = goal.target_amount;
    this.formCurrency = goal.currency;
    this.formTargetDateDisplay = goal.target_date
      ? toEuropeanDate(goal.target_date)
      : '';
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

  onFormCurrencyChange(currency: string): void {
    if (this.currencyLocked) {
      return;
    }

    this.formCurrency = currency;
  }

  startAddMoney(goal: FinancialGoal): void {
    if (this.loading || this.errorMessage !== null || this.allocating) {
      return;
    }

    this.formMode = null;
    this.editingId = null;
    this.reducingAllocationId = null;
    this.allocatingGoalId = goal.id;
    this.allocateAccountId = '';
    this.allocateAmount = '';
    this.allocateAmountError = null;
    this.allocateError = null;
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  cancelAddMoney(): void {
    if (this.allocating) {
      return;
    }

    this.closeAllocationPanels();
    this.changeDetector.detectChanges();
  }

  onAllocateAccountChange(accountId: string): void {
    this.allocateAccountId = accountId;
    this.allocateAmountError = null;
  }

  saveAllocation(): void {
    if (this.allocating || this.allocatingGoalId === null) {
      return;
    }

    const goal = this.goals.find(
      (item) => item.id === this.allocatingGoalId,
    );
    if (!goal) {
      return;
    }

    this.allocateAmountError = null;
    this.allocateError = null;

    if (!this.allocateAccountId) {
      this.allocateError = 'Select an account.';
      this.changeDetector.detectChanges();
      return;
    }

    const accountId = Number(this.allocateAccountId);
    const amount = normalizePositiveAmount(this.allocateAmount);
    if (amount === null) {
      this.allocateAmountError = 'Enter an amount greater than zero.';
      this.changeDetector.detectChanges();
      return;
    }

    const available = this.availableOnAccount(accountId);
    if (amount > available) {
      this.allocateAmountError =
        `Only ${available.toFixed(2)} is available on this account.`;
      this.changeDetector.detectChanges();
      return;
    }

    const existing = this.allocationForAccount(goal, accountId);
    this.allocating = true;
    this.successMessage = null;

    const request = existing
      ? this.goalService.updateAllocation(goal.id, existing.id, {
          amount: Number(
            (Number(existing.amount) + amount).toFixed(2),
          ),
        })
      : this.goalService.createAllocation(goal.id, {
          account_id: accountId,
          amount,
        });

    request.subscribe({
      next: () => {
        this.allocating = false;
        this.closeAllocationPanels();
        this.successMessage = 'Allocation updated.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.allocating = false;
        this.allocateError = formatApiError(
          error,
          'Unable to save the allocation.',
        );
        this.changeDetector.markForCheck();
      },
    });
  }

  startReduce(allocation: GoalAllocation): void {
    if (this.allocating) {
      return;
    }

    this.formMode = null;
    this.editingId = null;
    this.allocatingGoalId = null;
    this.reducingAllocationId = allocation.id;
    this.reduceAmount = allocation.amount;
    this.reduceAmountError = null;
    this.reduceError = null;
    this.successMessage = null;
    this.changeDetector.detectChanges();
  }

  cancelReduce(): void {
    if (this.allocating) {
      return;
    }

    this.reducingAllocationId = null;
    this.reduceAmountError = null;
    this.reduceError = null;
    this.changeDetector.detectChanges();
  }

  saveReduce(goal: FinancialGoal, allocation: GoalAllocation): void {
    if (this.allocating) {
      return;
    }

    const amount = normalizePositiveAmount(this.reduceAmount);
    if (amount === null) {
      this.reduceAmountError = 'Enter an amount greater than zero.';
      this.changeDetector.detectChanges();
      return;
    }

    if (amount >= Number(allocation.amount)) {
      this.reduceAmountError =
        'Enter an amount lower than the current designation.';
      this.changeDetector.detectChanges();
      return;
    }

    this.allocating = true;
    this.reduceError = null;
    this.goalService
      .updateAllocation(goal.id, allocation.id, { amount })
      .subscribe({
        next: () => {
          this.allocating = false;
          this.reducingAllocationId = null;
          this.successMessage = 'Allocation updated.';
          this.changeDetector.markForCheck();
          this.loadPage({ keepSuccessMessage: true });
        },
        error: (error: unknown) => {
          this.allocating = false;
          this.reduceError = formatApiError(
            error,
            'Unable to save the allocation.',
          );
          this.changeDetector.markForCheck();
        },
      });
  }

  removeAllocation(goal: FinancialGoal, allocation: GoalAllocation): void {
    if (this.allocating) {
      return;
    }

    this.allocating = true;
    this.reduceError = null;
    this.goalService.deleteAllocation(goal.id, allocation.id).subscribe({
      next: () => {
        this.allocating = false;
        this.reducingAllocationId = null;
        this.successMessage = 'Allocation removed.';
        this.changeDetector.markForCheck();
        this.loadPage({ keepSuccessMessage: true });
      },
      error: (error: unknown) => {
        this.allocating = false;
        this.reduceError = formatApiError(
          error,
          'Unable to remove the allocation.',
        );
        this.changeDetector.markForCheck();
      },
    });
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

  private closeAllocationPanels(): void {
    this.allocatingGoalId = null;
    this.allocateAccountId = '';
    this.allocateAmount = '';
    this.allocateAmountError = null;
    this.allocateError = null;
    this.reducingAllocationId = null;
    this.reduceAmount = '';
    this.reduceAmountError = null;
    this.reduceError = null;
  }

  private buildAllocationAmount(): number | null {
    if (!this.allocateAccountId) {
      return null;
    }

    const amount = normalizePositiveAmount(this.allocateAmount);
    if (amount === null) {
      return null;
    }

    const available = this.availableOnAccount(
      Number(this.allocateAccountId),
    );
    if (amount > available) {
      return null;
    }

    return amount;
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

    const targetAmount = normalizePositiveAmount(this.formTargetAmount);
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

    if (!valid || targetAmount === null) {
      return null;
    }

    return {
      name,
      target_amount: targetAmount,
      currency: this.formCurrency,
      target_date: targetDate,
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
