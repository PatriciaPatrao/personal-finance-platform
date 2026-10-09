import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisSummary } from '../analysis/analysis-summary';
import { ForecastResponse } from '../forecast/forecast-response';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialGoal, GoalAllocation } from '../goals/goal';
import { GoalService } from '../goals/goal.service';
import {
  deriveFinancialSignals,
  FinancialSignal,
  quietCheckDetail,
} from './financial-signals';

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
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './personal-finance.html',
  styleUrl: './personal-finance.scss',
})
export class PersonalFinance implements OnInit {
  accountsLoading = true;
  analysisLoading = true;
  forecastLoading = true;
  goalsLoading = true;
  accountsError = false;
  analysisError = false;
  forecastError = false;
  goalsError = false;

  accounts: Account[] = [];
  currentPosition: CurrentPositionState | null = null;
  summary: AnalysisSummary | null = null;
  forecast: ForecastResponse | null = null;
  goals: FinancialGoal[] = [];

  constructor(
    private accountService: AccountService,
    private analysisService: AnalysisService,
    private forecastService: ForecastService,
    private goalService: GoalService,
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

  get signalsSuppressed(): boolean {
    return this.currentPosition?.kind === 'by_currency';
  }

  get signals(): FinancialSignal[] {
    if (this.accountsLoading || this.signalsSuppressed) {
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
      this.analysisLoading ||
      this.forecastLoading ||
      this.signalsSuppressed ||
      this.signals.length > 0
    ) {
      return '';
    }

    return quietCheckDetail(this.summary, this.forecast);
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  progressText(goal: FinancialGoal): string {
    if (goal.progress === null) {
      return 'Progress unavailable';
    }

    const value = Number(goal.progress);
    if (!Number.isFinite(value)) {
      return 'Progress unavailable';
    }

    return `${Math.round(value * 100)}%`;
  }

  accountLabel(accountId: number): string {
    const account = this.accounts.find((item) => item.id === accountId);
    return account ? account.name : `Account ${accountId}`;
  }

  underfundedAllocations(goal: FinancialGoal): GoalAllocation[] {
    return goal.allocations.filter(
      (allocation) =>
        parseMoneyMinorUnits(allocation.funded_amount) <
        parseMoneyMinorUnits(allocation.amount),
    );
  }

  private loadDashboard(): void {
    this.accountsLoading = true;
    this.analysisLoading = true;
    this.forecastLoading = true;
    this.goalsLoading = true;
    this.accountsError = false;
    this.analysisError = false;
    this.forecastError = false;
    this.goalsError = false;
    this.accounts = [];
    this.currentPosition = null;
    this.summary = null;
    this.forecast = null;
    this.goals = [];

    const analysisRange = currentMonthRange();
    const forecastRange = defaultForecastRange();

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
        } else {
          this.accounts = [];
          this.currentPosition = null;
        }
        this.changeDetector.markForCheck();
      });

    this.analysisService
      .getSummary(analysisRange.from, analysisRange.to)
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

    this.forecastService
      .getForecast(forecastRange.from, forecastRange.to, 'month')
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

  private sumBalances(accounts: Account[]): string {
    const total = accounts.reduce(
      (sum, account) => sum + parseMoneyMinorUnits(account.current_balance),
      0n,
    );
    return formatMoneyMinorUnits(total);
  }
}
