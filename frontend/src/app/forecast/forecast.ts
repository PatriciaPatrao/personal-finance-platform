import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { DateField } from '../analysis/date-field';
import {
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
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

@Component({
  selector: 'app-forecast',
  imports: [CurrencyPipe, DateField],
  templateUrl: './forecast.html',
  styleUrl: './forecast.scss',
})
export class Forecast implements OnInit {
  private readonly initialRange = defaultForecastRange();

  from = this.initialRange.from;
  to = this.initialRange.to;
  fromDisplay = toEuropeanDate(this.from);
  toDisplay = toEuropeanDate(this.to);
  groupBy: ForecastGroupBy = 'month';

  forecast: ForecastResponse | null = null;

  loading = true;
  errorMessage: string | null = null;
  validationMessage: string | null = null;

  constructor(
    private forecastService: ForecastService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get startingBalance(): string | null {
    if (!this.forecast || this.forecast.periods.length === 0) {
      return null;
    }

    const firstPeriod = this.forecast.periods[0];
    const projected = parseMoneyMinorUnits(firstPeriod.projected_balance);
    const netCashFlow = parseMoneyMinorUnits(firstPeriod.net_cash_flow);
    return formatMoneyMinorUnits(projected - netCashFlow);
  }

  get endingProjectedBalance(): string | null {
    if (!this.forecast || this.forecast.periods.length === 0) {
      return null;
    }

    const lastPeriod =
      this.forecast.periods[this.forecast.periods.length - 1];
    return lastPeriod.projected_balance;
  }

  get endingProjectedBalanceDate(): string | null {
    if (!this.forecast || this.forecast.periods.length === 0) {
      return null;
    }

    return formatLongDate(this.forecast.to_date);
  }

  get hasZeroSchedule(): boolean {
    if (!this.forecast || this.forecast.periods.length === 0) {
      return false;
    }

    return this.forecast.periods.every(
      (period) =>
        parseMoneyMinorUnits(period.income) === 0n &&
        parseMoneyMinorUnits(period.expenses) === 0n,
    );
  }

  ngOnInit(): void {
    this.loadForecast();
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

  onGroupByChange(groupBy: string): void {
    if (groupBy !== 'day' && groupBy !== 'month') {
      return;
    }

    this.groupBy = groupBy;
    this.loadForecast();
  }

  trackPeriod(_index: number, period: ForecastPeriod): string {
    return period.period;
  }

  private clearForecastResult(): void {
    this.forecast = null;
    this.loading = false;
    this.errorMessage = null;
  }

  private loadForecast(): void {
    this.loading = true;
    this.errorMessage = null;
    this.forecast = null;

    this.forecastService
      .getForecast(this.from, this.to, this.groupBy)
      .subscribe({
        next: (forecast: ForecastResponse) => {
          this.forecast = forecast;
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.forecast = null;
          this.errorMessage = 'Unable to load the forecast.';
          this.loading = false;
          this.changeDetector.markForCheck();
        },
      });
  }
}
