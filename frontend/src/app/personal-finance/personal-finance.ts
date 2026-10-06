import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisSummary } from '../analysis/analysis-summary';
import { ForecastResponse } from '../forecast/forecast-response';
import { ForecastService } from '../forecast/forecast.service';
import {
  deriveFinancialSignals,
  FinancialSignal,
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

export type CurrentPositionState =
  | { kind: 'empty' }
  | { kind: 'mixed_currency' }
  | { kind: 'ready'; amount: string; currency: string };

@Component({
  selector: 'app-personal-finance',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './personal-finance.html',
  styleUrl: './personal-finance.scss',
})
export class PersonalFinance implements OnInit {
  loading = true;
  accountsError = false;
  signalsError = false;

  currentPosition: CurrentPositionState | null = null;
  summary: AnalysisSummary | null = null;
  forecast: ForecastResponse | null = null;
  signals: FinancialSignal[] = [];

  constructor(
    private accountService: AccountService,
    private analysisService: AnalysisService,
    private forecastService: ForecastService,
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

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.loading = true;
    this.accountsError = false;
    this.signalsError = false;
    this.currentPosition = null;
    this.summary = null;
    this.forecast = null;
    this.signals = [];

    const analysisRange = currentMonthRange();
    const forecastRange = defaultForecastRange();

    forkJoin({
      accounts: this.accountService.listAccounts().pipe(
        map((data): LoadResult<Account[]> => ({ ok: true, data })),
        catchError(() => of<LoadResult<Account[]>>({ ok: false })),
      ),
      summary: this.analysisService
        .getSummary(analysisRange.from, analysisRange.to)
        .pipe(
          map((data): LoadResult<AnalysisSummary> => ({ ok: true, data })),
          catchError(() => of<LoadResult<AnalysisSummary>>({ ok: false })),
        ),
      forecast: this.forecastService
        .getForecast(forecastRange.from, forecastRange.to, 'month')
        .pipe(
          map((data): LoadResult<ForecastResponse> => ({ ok: true, data })),
          catchError(() => of<LoadResult<ForecastResponse>>({ ok: false })),
        ),
    }).subscribe({
      next: ({ accounts, summary, forecast }) => {
        this.accountsError = !accounts.ok;
        this.signalsError = !summary.ok || !forecast.ok;

        if (accounts.ok) {
          this.currentPosition = this.buildCurrentPosition(accounts.data);
        } else {
          this.currentPosition = null;
        }

        if (!this.signalsError && summary.ok && forecast.ok) {
          this.summary = summary.data;
          this.forecast = forecast.data;
          this.signals = deriveFinancialSignals(summary.data, forecast.data);
        } else {
          this.summary = null;
          this.forecast = null;
          this.signals = [];
        }

        this.loading = false;
        this.changeDetector.markForCheck();
      },
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
    if (!sameCurrency) {
      return { kind: 'mixed_currency' };
    }

    const total = accounts.reduce(
      (sum, account) => sum + parseMoneyMinorUnits(account.current_balance),
      0n,
    );

    return {
      kind: 'ready',
      amount: formatMoneyMinorUnits(total),
      currency,
    };
  }
}
