import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { DateField } from '../analysis/date-field';
import { CopyTable } from '../copy-table/copy-table';
import {
  ForecastCurrencyProjection,
  ForecastGroupBy,
  ForecastPeriod,
  ForecastResponse,
} from './forecast-response';
import { ForecastService } from './forecast.service';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
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
  const fraction = absolute % 100n;
  return `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}

@Component({
  selector: 'app-forecast',
  imports: [CopyTable, CurrencyPipe, DateField],
  templateUrl: './forecast.html',
  styleUrl: './forecast.scss',
})
export class Forecast implements OnInit {
  private readonly initialRange = defaultForecastRange();

  from = this.initialRange.from;
  to = this.initialRange.to;
  fromDisplay = toEuropeanDate(this.from);
  toDisplay = toEuropeanDate(this.to);
  groupByByCurrency: Record<string, ForecastGroupBy> = {};
  accountFilter: 'all' | string = 'all';

  accounts: Account[] = [];
  accountsLoading = true;

  forecast: ForecastResponse | null = null;

  loading = true;
  errorMessage: string | null = null;
  validationMessage: string | null = null;
  periodsUpdatingByCurrency: Record<string, boolean> = {};
  periodsErrorByCurrency: Record<string, string> = {};

  private loadGeneration = 0;

  constructor(
    private accountService: AccountService,
    private forecastService: ForecastService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get displayProjections(): ForecastCurrencyProjection[] {
    return this.forecast?.projections ?? [];
  }

  groupByForCurrency(currency: string): ForecastGroupBy {
    return this.groupByByCurrency[currency] ?? 'month';
  }

  get scopeIntro(): string {
    if (this.accountFilter === 'all') {
      return (
        'Household projections are calculated separately for each ' +
        'currency. Amounts are never combined across currencies and ' +
        'there is no currency conversion.'
      );
    }

    const account = this.accounts.find(
      (item) => String(item.id) === this.accountFilter,
    );
    const name = account?.name ?? 'this account';
    return (
      `Projection for ${name} using its stored balance and linked ` +
      'active schedules only.'
    );
  }

  get endingProjectedBalanceDate(): string | null {
    if (!this.forecast) {
      return null;
    }

    return formatLongDate(this.forecast.to_date);
  }

  ngOnInit(): void {
    this.accountsLoading = true;
    this.accountService.listAccounts().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.accountsLoading = false;
        this.loadForecast();
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.accounts = [];
        this.accountsLoading = false;
        this.loadForecast();
        this.changeDetector.markForCheck();
      },
    });
  }

  apply(): void {
    const from = parseEuropeanDate(this.fromDisplay);
    const to = parseEuropeanDate(this.toDisplay);
    if (!from || !to) {
      this.validationMessage = 'Enter dates as DD-MM-YYYY.';
      this.clearForecastResult();
      this.changeDetector.detectChanges();
      return;
    }

    if (from > to) {
      this.validationMessage = 'From must be on or before To.';
      this.clearForecastResult();
      this.changeDetector.detectChanges();
      return;
    }

    this.from = from;
    this.to = to;
    this.validationMessage = null;
    this.loadForecast();
  }

  onGroupByChange(currency: string, groupBy: string): void {
    if (groupBy !== 'day' && groupBy !== 'month') {
      return;
    }

    this.groupByByCurrency = {
      ...this.groupByByCurrency,
      [currency]: groupBy,
    };
    this.loadForecast({ groupingOnly: true, currency });
    this.changeDetector.markForCheck();
  }

  isPeriodsUpdating(currency: string): boolean {
    return this.periodsUpdatingByCurrency[currency] ?? false;
  }

  periodsErrorForCurrency(currency: string): string | null {
    return this.periodsErrorByCurrency[currency] ?? null;
  }

  onAccountFilterChange(value: string): void {
    this.accountFilter = value === 'all' ? 'all' : value;
    this.loadForecast();
  }

  trackProjection(_index: number, projection: ForecastCurrencyProjection): string {
    return projection.currency;
  }

  trackPeriod(_index: number, period: ForecastPeriod): string {
    return period.period;
  }

  endingProjectedBalance(
    projection: ForecastCurrencyProjection,
  ): string | null {
    if (projection.periods.length === 0) {
      return null;
    }

    return projection.periods[projection.periods.length - 1].projected_balance;
  }

  netIncome(projection: ForecastCurrencyProjection): string | null {
    const ending = this.endingProjectedBalance(projection);
    if (ending === null) {
      return null;
    }

    const netMinorUnits =
      parseMoneyMinorUnits(ending) -
      parseMoneyMinorUnits(projection.starting_balance);
    return formatMoneyMinorUnits(netMinorUnits);
  }

  isNetIncomePositive(projection: ForecastCurrencyProjection): boolean {
    const net = this.netIncome(projection);
    if (net === null) {
      return false;
    }

    return parseMoneyMinorUnits(net) > 0n;
  }

  hasZeroSchedule(projection: ForecastCurrencyProjection): boolean {
    if (projection.periods.length === 0) {
      return false;
    }

    return projection.periods.every(
      (period) =>
        parseMoneyMinorUnits(period.income) === 0n &&
        parseMoneyMinorUnits(period.expenses) === 0n,
    );
  }

  private clearForecastResult(): void {
    this.forecast = null;
    this.loading = false;
    this.errorMessage = null;
  }

  private loadForecast(options?: {
    groupingOnly?: boolean;
    currency?: string;
  }): void {
    const groupingOnly = options?.groupingOnly ?? false;
    const currency = options?.currency;
    const generation = ++this.loadGeneration;

    if (groupingOnly && this.forecast) {
      if (currency) {
        this.periodsUpdatingByCurrency = {
          ...this.periodsUpdatingByCurrency,
          [currency]: true,
        };
        const { [currency]: _removed, ...restErrors } =
          this.periodsErrorByCurrency;
        this.periodsErrorByCurrency = restErrors;
      }
    } else {
      this.loading = true;
      this.errorMessage = null;
      this.forecast = null;
      this.periodsUpdatingByCurrency = {};
      this.periodsErrorByCurrency = {};
    }

    const accountId =
      this.accountFilter === 'all'
        ? undefined
        : Number(this.accountFilter);

    const { groupBy, groupByOverrides } = this.buildGroupByRequest();

    this.forecastService
      .getForecast(
        this.from,
        this.to,
        groupBy,
        accountId,
        groupByOverrides,
      )
      .subscribe({
        next: (forecast: ForecastResponse) => {
          if (generation !== this.loadGeneration) {
            return;
          }
          this.forecast = forecast;
          this.syncGroupByFromForecast(forecast);
          this.loading = false;
          this.clearPeriodsUpdating(currency);
          this.changeDetector.markForCheck();
        },
        error: () => {
          if (generation !== this.loadGeneration) {
            return;
          }
          if (groupingOnly && this.forecast && currency) {
            this.clearPeriodsUpdating(currency);
            this.periodsErrorByCurrency = {
              ...this.periodsErrorByCurrency,
              [currency]: 'Unable to update this forecast table.',
            };
            this.changeDetector.markForCheck();
            return;
          }
          this.forecast = null;
          this.errorMessage = 'Unable to load the forecast.';
          this.loading = false;
          this.changeDetector.markForCheck();
        },
      });
  }

  private clearPeriodsUpdating(currency?: string): void {
    if (!currency) {
      this.periodsUpdatingByCurrency = {};
      return;
    }

    const { [currency]: _removed, ...rest } = this.periodsUpdatingByCurrency;
    this.periodsUpdatingByCurrency = rest;
  }

  private buildGroupByRequest(): {
    groupBy: ForecastGroupBy;
    groupByOverrides?: Record<string, ForecastGroupBy>;
  } {
    const entries = Object.entries(this.groupByByCurrency);
    if (entries.length === 0) {
      return { groupBy: 'month' };
    }

    const groupingValues = new Set(entries.map(([, value]) => value));
    if (groupingValues.size === 1) {
      return { groupBy: entries[0][1] };
    }

    const defaultGroupBy: ForecastGroupBy = 'month';
    const groupByOverrides: Record<string, ForecastGroupBy> = {};
    for (const [currency, value] of entries) {
      if (value !== defaultGroupBy) {
        groupByOverrides[currency] = value;
      }
    }

    return {
      groupBy: defaultGroupBy,
      groupByOverrides:
        Object.keys(groupByOverrides).length > 0
          ? groupByOverrides
          : undefined,
    };
  }

  private syncGroupByFromForecast(forecast: ForecastResponse): void {
    const next: Record<string, ForecastGroupBy> = {
      ...this.groupByByCurrency,
    };
    for (const projection of forecast.projections) {
      next[projection.currency] = projection.group_by;
    }
    this.groupByByCurrency = next;
  }
}
