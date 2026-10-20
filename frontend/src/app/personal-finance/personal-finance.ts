import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { catchError, forkJoin, map, of } from 'rxjs';

import { Account } from '../accounts/account';
import { accountDisplayName } from '../accounts/account-display';
import { AccountService } from '../accounts/account.service';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisSummary } from '../analysis/analysis-summary';
import { ForecastResponse } from '../forecast/forecast-response';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialGoal } from '../goals/goal';
import { GoalService } from '../goals/goal.service';
import { Income } from '../schedules/income';
import { IncomeService } from '../schedules/income.service';
import { RecurringExpense } from '../schedules/recurring-expense';
import { RecurringExpenseService } from '../schedules/recurring-expense.service';
import { TransactionService } from '../transactions/transactions.service';
import {
  buildUpcomingCommitments,
  groupUpcomingByCurrency,
  hasActiveScheduleOccurrenceWithinDays,
  UpcomingCommitment,
} from './dashboard-upcoming';
import {
  buildDashboardAttentionItems,
  DashboardAttentionItem,
  goalProgressRatio,
  goalRemainingAmount,
  underfundedAllocations,
} from './dashboard-attention';
import {
  DashboardPrimaryAction,
  resolveDashboardPrimaryAction,
} from './dashboard-primary-action';
import {
  CurrencyFinancialSignalGroup,
  deriveFinancialSignals,
  deriveFinancialSignalsByCurrency,
  FinancialSignal,
  quietCheckDetail,
  signalActionIcon,
  signalActionLabel,
  signalActionRoute,
} from './financial-signals';
import { DomainDateService } from '../shared/domain-date.service';
import {
  buildDashboardOutlookGroups,
  DashboardOutlookGroup,
  outlookTrendDetail,
} from './dashboard-outlook';
import { BalanceSparkTrend } from '../forecast/forecast-visuals';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthRange(today: Date = new Date()): {
  from: string;
  to: string;
} {
  return {
    from: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: formatDate(today),
  };
}

function defaultForecastRange(today: Date = new Date()): {
  from: string;
  to: string;
} {
  const to = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  return {
    from: formatDate(today),
    to: formatDate(to),
  };
}

function parseMoneyMinorUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = (match[3] ?? '00').padEnd(2, '0');
  return sign * (whole * 100n + BigInt(fraction));
}

function formatMoneyMinorUnits(minorUnits: bigint): string {
  const sign = minorUnits < 0n ? '-' : '';
  const absolute = minorUnits < 0n ? -minorUnits : minorUnits;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

function toEuropeanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false };

export type CurrencyTotal = {
  currency: string;
  amount: string;
};

export type CurrentPositionState =
  | { kind: 'empty' }
  | { kind: 'ready'; amount: string; currency: string }
  | { kind: 'by_currency'; totals: CurrencyTotal[] };

@Component({
  selector: 'app-personal-finance',
  imports: [Button, Card, CurrencyPipe, Message, RouterLink],
  templateUrl: './personal-finance.html',
  styleUrl: './personal-finance.scss',
})
export class PersonalFinance implements OnInit {
  accountsLoading = true;
  analysisLoading = true;
  forecastLoading = true;
  goalsLoading = true;
  transactionsLoading = false;
  schedulesLoading = false;
  accountsError = false;
  analysisError = false;
  forecastError = false;
  goalsError = false;
  transactionsLoadFailed = false;
  schedulesLoadFailed = false;

  accounts: Account[] = [];
  currentPosition: CurrentPositionState | null = null;
  summary: AnalysisSummary | null = null;
  forecast: ForecastResponse | null = null;
  goals: FinancialGoal[] = [];
  transactionCount: number | null = null;
  hasActiveScheduleOccurrenceToday = false;
  hasActiveScheduleOccurrenceWithinSevenDays = false;
  incomes: Income[] = [];
  recurringExpenses: RecurringExpense[] = [];
  commitmentWindowFrom = '';
  commitmentWindowTo = '';

  readonly quickLinks = [
    {
      label: 'Transactions',
      route: '/personal_finance/transactions',
      icon: 'pi pi-list',
      description: 'Record and review history',
    },
    {
      label: 'Accounts',
      route: '/personal_finance/accounts',
      icon: 'pi pi-wallet',
      description: 'Balances and account details',
    },
    {
      label: 'Schedules',
      route: '/personal_finance/schedules',
      icon: 'pi pi-calendar',
      description: 'Salary and recurring expenses',
    },
    {
      label: 'Forecast',
      route: '/personal_finance/forecast',
      icon: 'pi pi-chart-line',
      description: 'Projected balances',
    },
    {
      label: 'Analysis',
      route: '/personal_finance/analysis',
      icon: 'pi pi-chart-bar',
      description: 'Past income and spending',
    },
    {
      label: 'Goals',
      route: '/personal_finance/goals',
      icon: 'pi pi-flag',
      description: 'Targets and allocations',
    },
  ] as const;

  constructor(
    private accountService: AccountService,
    private analysisService: AnalysisService,
    private forecastService: ForecastService,
    private goalService: GoalService,
    private transactionService: TransactionService,
    private incomeService: IncomeService,
    private recurringExpenseService: RecurringExpenseService,
    private domainDateService: DomainDateService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get analysisRangeLabel(): string | null {
    if (!this.summary) {
      return null;
    }

    return `${toEuropeanDate(this.summary.from_date)} to ${toEuropeanDate(this.summary.to_date)}`;
  }

  get forecastRangeLabel(): string | null {
    if (!this.forecast) {
      return null;
    }

    return `${toEuropeanDate(this.forecast.from_date)} to ${toEuropeanDate(this.forecast.to_date)}`;
  }

  get accountsCount(): number {
    return this.accounts.length;
  }

  get outlookGroups(): DashboardOutlookGroup[] {
    if (this.forecastLoading || this.forecastError || !this.forecast) {
      return [];
    }

    return buildDashboardOutlookGroups(this.forecast);
  }

  get showNearTermOutlookSection(): boolean {
    return (
      !this.accountsLoading &&
      !this.accountsError &&
      this.currentPosition?.kind !== 'empty'
    );
  }

  outlookTrendShortLabel(trend: BalanceSparkTrend): string {
    switch (trend) {
      case 'rising':
        return 'Projected to rise';
      case 'falling':
        return 'Projected to fall';
      case 'stable':
        return 'Projected stable';
    }
  }

  outlookTrendAccessibleDetail(trend: BalanceSparkTrend): string {
    return outlookTrendDetail(trend);
  }

  get signalsSuppressed(): boolean {
    return this.currentPosition?.kind === 'by_currency';
  }

  get perCurrencySignals(): CurrencyFinancialSignalGroup[] {
    if (this.accountsLoading || this.accountsError || !this.signalsSuppressed) {
      return [];
    }

    return deriveFinancialSignalsByCurrency(
      this.analysisLoading || this.analysisError ? null : this.summary,
      this.forecastLoading || this.forecastError ? null : this.forecast,
    );
  }

  get signals(): FinancialSignal[] {
    if (this.accountsLoading || this.accountsError || this.signalsSuppressed) {
      return [];
    }

    return deriveFinancialSignals(
      this.analysisLoading || this.analysisError ? null : this.summary,
      this.forecastLoading || this.forecastError ? null : this.forecast,
    );
  }

  get quietCheckText(): string {
    if (
      this.accountsLoading ||
      this.accountsError ||
      this.analysisLoading ||
      this.forecastLoading ||
      this.signalsSuppressed ||
      this.signals.length > 0
    ) {
      return '';
    }

    return quietCheckDetail(this.summary, this.forecast);
  }

  get commitmentRangeLabel(): string | null {
    if (!this.commitmentWindowFrom || !this.commitmentWindowTo) {
      return null;
    }

    return `${toEuropeanDate(this.commitmentWindowFrom)} to ${toEuropeanDate(this.commitmentWindowTo)}`;
  }

  get upcomingCommitments(): UpcomingCommitment[] {
    if (
      this.accountsLoading ||
      this.accountsError ||
      this.currentPosition?.kind === 'empty'
    ) {
      return [];
    }

    return buildUpcomingCommitments({
      windowFrom: this.commitmentWindowFrom,
      windowTo: this.commitmentWindowTo,
      incomes: this.incomes,
      expenses: this.recurringExpenses,
      accounts: this.accounts,
    });
  }

  get upcomingByCurrency(): {
    currency: string;
    items: UpcomingCommitment[];
  }[] {
    return groupUpcomingByCurrency(this.upcomingCommitments);
  }

  get primaryAction(): DashboardPrimaryAction | null {
    return resolveDashboardPrimaryAction({
      accountsLoading: this.accountsLoading,
      accountsError: this.accountsError,
      hasAccounts: this.currentPosition?.kind !== 'empty',
      transactionsLoading: this.transactionsLoading,
      transactionsLoadFailed: this.transactionsLoadFailed,
      transactionCount: this.transactionCount,
      schedulesLoading: this.schedulesLoading,
      schedulesLoadFailed: this.schedulesLoadFailed,
      hasActiveScheduleOccurrenceToday:
        this.hasActiveScheduleOccurrenceToday,
      hasActiveScheduleOccurrenceWithinSevenDays:
        this.hasActiveScheduleOccurrenceWithinSevenDays,
    });
  }

  get attentionItems(): DashboardAttentionItem[] {
    if (this.accountsLoading || this.accountsError || this.goalsLoading) {
      return [];
    }

    return buildDashboardAttentionItems(
      this.accounts,
      this.goals,
      (accountId) => this.accountLabel(accountId),
    );
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  signalRoute(signal: FinancialSignal): string | null {
    return signalActionRoute(signal.title);
  }

  signalActionButtonLabel(signal: FinancialSignal): string {
    return signalActionLabel(signal.title);
  }

  signalActionButtonIcon(signal: FinancialSignal): string {
    return signalActionIcon(signal.title);
  }

  displayEuropeanDate(isoDate: string): string {
    return toEuropeanDate(isoDate);
  }

  progressPercent(goal: FinancialGoal): number | null {
    const ratio = goalProgressRatio(goal);
    if (ratio === null) {
      return null;
    }

    const percent = Math.round(ratio * 100);
    if (!Number.isFinite(percent)) {
      return null;
    }

    return Math.max(0, Math.min(100, percent));
  }

  goalRemainingAmount(goal: FinancialGoal): string | null {
    return goalRemainingAmount(goal);
  }

  progressText(goal: FinancialGoal): string {
    const percent = this.progressPercent(goal);
    if (percent === null) {
      return 'Progress unavailable';
    }

    return `${percent}%`;
  }

  accountLabel(accountId: number): string {
    return accountDisplayName(accountId, this.accounts);
  }

  underfundedAllocations(goal: FinancialGoal) {
    return underfundedAllocations(goal);
  }

  private loadDashboard(): void {
    this.accountsLoading = true;
    this.analysisLoading = true;
    this.forecastLoading = true;
    this.goalsLoading = true;
    this.transactionsLoading = false;
    this.schedulesLoading = false;
    this.accountsError = false;
    this.analysisError = false;
    this.forecastError = false;
    this.goalsError = false;
    this.transactionsLoadFailed = false;
    this.schedulesLoadFailed = false;
    this.accounts = [];
    this.currentPosition = null;
    this.summary = null;
    this.forecast = null;
    this.goals = [];
    this.transactionCount = null;
    this.hasActiveScheduleOccurrenceToday = false;
    this.hasActiveScheduleOccurrenceWithinSevenDays = false;
    this.incomes = [];
    this.recurringExpenses = [];

    const analysisRange = currentMonthRange();
    const forecastRange = defaultForecastRange();
    this.commitmentWindowFrom = forecastRange.from;
    this.commitmentWindowTo = forecastRange.to;

    this.accountService
      .listAccounts()
      .pipe(
        map((data): LoadResult<Account[]> => ({ ok: true, data })),
        catchError(() => of<LoadResult<Account[]>>({ ok: false })),
      )
      .subscribe((accounts) => {
        this.accountsLoading = false;
        this.accountsError = !accounts.ok;
        if (accounts.ok) {
          this.accounts = accounts.data;
          this.currentPosition = this.buildCurrentPosition(accounts.data);
          if (this.currentPosition.kind === 'empty') {
            this.transactionCount = 0;
            this.transactionsLoading = false;
            this.schedulesLoading = false;
          } else {
            this.loadSupportingContext();
          }
        } else {
          this.accounts = [];
          this.currentPosition = null;
          this.transactionsLoading = false;
          this.schedulesLoading = false;
        }
        if (!accounts.ok) {
          this.skipFinancialSignals();
        } else if (this.currentPosition?.kind === 'empty') {
          this.skipFinancialSignals();
        } else {
          this.loadAnalysis(analysisRange);
          this.loadHouseholdForecast(forecastRange);
        }
        this.changeDetector.markForCheck();
      });

    this.goalService
      .listGoals()
      .pipe(
        map((data): LoadResult<FinancialGoal[]> => ({ ok: true, data })),
        catchError(() => of<LoadResult<FinancialGoal[]>>({ ok: false })),
      )
      .subscribe((goals) => {
        this.goalsLoading = false;
        this.goalsError = !goals.ok;
        this.goals = goals.ok ? goals.data : [];
        this.changeDetector.markForCheck();
      });
  }

  private loadSupportingContext(): void {
    this.transactionsLoading = true;
    this.schedulesLoading = true;

    forkJoin({
      domainDate: this.domainDateService.loadCurrentDomainDate(),
      transactions: this.transactionService.listTransactions().pipe(
        map((data) => ({ ok: true as const, data })),
        catchError(() => of({ ok: false as const, data: [] })),
      ),
      incomes: this.incomeService.listIncomes().pipe(
        map((data) => ({ ok: true as const, data })),
        catchError(() => of({ ok: false as const, data: [] })),
      ),
      expenses: this.recurringExpenseService.listRecurringExpenses().pipe(
        map((data) => ({ ok: true as const, data })),
        catchError(() => of({ ok: false as const, data: [] })),
      ),
    }).subscribe(({ domainDate, transactions, incomes, expenses }) => {
      const today = domainDate;
      this.transactionsLoading = false;
      this.schedulesLoading = false;
      this.transactionsLoadFailed = !transactions.ok;
      this.schedulesLoadFailed = !incomes.ok || !expenses.ok;
      this.incomes = incomes.ok ? incomes.data : [];
      this.recurringExpenses = expenses.ok ? expenses.data : [];
      this.transactionCount = transactions.ok
        ? transactions.data.length
        : null;
      if (today === null) {
        this.hasActiveScheduleOccurrenceToday = false;
        this.hasActiveScheduleOccurrenceWithinSevenDays = false;
      } else {
        const incomeDue =
          incomes.ok &&
          incomes.data.some(
            (item) => item.active && item.next_occurrence === today,
          );
        const expenseDue =
          expenses.ok &&
          expenses.data.some(
            (item) => item.active && item.next_occurrence === today,
          );
        this.hasActiveScheduleOccurrenceToday = incomeDue || expenseDue;
        this.hasActiveScheduleOccurrenceWithinSevenDays =
          hasActiveScheduleOccurrenceWithinDays(
            this.incomes,
            this.recurringExpenses,
            today,
            7,
          );
      }
      this.changeDetector.markForCheck();
    });
  }

  private buildCurrentPosition(accounts: Account[]): CurrentPositionState {
    if (accounts.length === 0) {
      return { kind: 'empty' };
    }

    const currency = accounts[0].currency;
    const sameCurrency = accounts.every(
      (account) => account.currency === currency,
    );
    if (sameCurrency) {
      return {
        kind: 'ready',
        amount: this.sumBalances(accounts),
        currency,
      };
    }

    const order: string[] = [];
    const groups = new Map<string, Account[]>();
    for (const account of accounts) {
      const group = groups.get(account.currency);
      if (group) {
        group.push(account);
      } else {
        order.push(account.currency);
        groups.set(account.currency, [account]);
      }
    }

    return {
      kind: 'by_currency',
      totals: order.map((code) => ({
        currency: code,
        amount: this.sumBalances(groups.get(code) ?? []),
      })),
    };
  }

  private skipFinancialSignals(): void {
    this.analysisLoading = false;
    this.analysisError = false;
    this.summary = null;
    this.forecastLoading = false;
    this.forecastError = false;
    this.forecast = null;
  }

  private loadAnalysis(range: { from: string; to: string }): void {
    this.analysisLoading = true;
    this.analysisError = false;
    this.summary = null;
    this.analysisService
      .getSummary(range.from, range.to)
      .pipe(
        map((data): LoadResult<AnalysisSummary> => ({ ok: true, data })),
        catchError(() => of<LoadResult<AnalysisSummary>>({ ok: false })),
      )
      .subscribe((summary) => {
        this.analysisLoading = false;
        this.analysisError = !summary.ok;
        this.summary = summary.ok ? summary.data : null;
        this.changeDetector.markForCheck();
      });
  }

  private loadHouseholdForecast(range: { from: string; to: string }): void {
    this.forecastLoading = true;
    this.forecastError = false;
    this.forecast = null;
    this.forecastService
      .getForecast(range.from, range.to, 'month')
      .pipe(
        map((data): LoadResult<ForecastResponse> => ({ ok: true, data })),
        catchError(() => of<LoadResult<ForecastResponse>>({ ok: false })),
      )
      .subscribe((forecast) => {
        this.forecastLoading = false;
        this.forecastError = !forecast.ok;
        this.forecast = forecast.ok ? forecast.data : null;
        this.changeDetector.markForCheck();
      });
  }

  private sumBalances(accounts: Account[]): string {
    const total = accounts.reduce(
      (sum, account) => sum + parseMoneyMinorUnits(account.current_balance),
      0n,
    );
    return formatMoneyMinorUnits(total);
  }
}
