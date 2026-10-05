import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { DateField } from '../analysis/date-field';
import {
  ForecastGroupBy,
  ForecastPeriod,
  ForecastResponse,
} from './forecast-response';
import { ForecastService } from './forecast.service';

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

  get endingProjectedBalance(): string | null {
    if (!this.forecast || this.forecast.periods.length === 0) {
      return null;
    }

    const lastPeriod =
      this.forecast.periods[this.forecast.periods.length - 1];
    return lastPeriod.projected_balance;
  }

  ngOnInit(): void {
    this.loadForecast();
  }

  apply(): void {
    const from = parseEuropeanDate(this.fromDisplay);
    const to = parseEuropeanDate(this.toDisplay);
    if (!from || !to) {
      this.validationMessage = 'Enter dates as DD-MM-YYYY.';
      this.changeDetector.detectChanges();
      return;
    }

    this.from = from;
    this.to = to;

    if (this.from > this.to) {
      this.validationMessage = 'From must be on or before To.';
      this.changeDetector.detectChanges();
      return;
    }

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

  private loadForecast(): void {
    this.loading = true;
    this.errorMessage = null;

    this.forecastService
      .getForecast(this.from, this.to, this.groupBy)
      .subscribe({
        next: (forecast: ForecastResponse) => {
          this.forecast = forecast;
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Unable to load the forecast.';
          this.loading = false;
          this.changeDetector.markForCheck();
        },
      });
  }
}
