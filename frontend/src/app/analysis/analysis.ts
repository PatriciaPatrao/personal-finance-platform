import { CurrencyPipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';

import { AnalysisService } from './analysis.service';
import {
  activePeriodPreset,
  formatPeriodRangeLabel,
  lastMonthRange,
  PeriodPresetId,
  thisMonthRange,
  toEuropeanDate,
} from './analysis-period-presets';
import {
  AnalysisSummary,
  CashFlow,
  CashFlowGroupBy,
  CashFlowPeriod,
  CurrencyAnalysisTotals,
  CurrencyCashFlow,
  ExpensesByCategory,
} from './analysis-summary';
import {
  cashFlowNetSparkBars,
  categoryShareBarWidth,
  incomeExpenseBarWidths,
  latestPeriodKey,
  netCashFlowSignLabel,
} from './analysis-visuals';
import { CopyTable } from '../copy-table/copy-table';
import { DateField } from './date-field';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  selector: 'app-analysis',
  imports: [
    Button,
    Card,
    CopyTable,
    CurrencyPipe,
    DateField,
    FormsModule,
    LowerCasePipe,
    Message,
    Select,
  ],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class Analysis implements OnInit {
  readonly groupByOptions = [
    { label: 'Monthly', value: 'month' as CashFlowGroupBy },
    { label: 'Daily', value: 'day' as CashFlowGroupBy },
  ];

  from = thisMonthRange().from;
  to = thisMonthRange().to;
  fromDisplay = toEuropeanDate(this.from);
  toDisplay = toEuropeanDate(this.to);
  maxTo = formatDate(new Date());
  groupBy: CashFlowGroupBy = 'month';

  summary: AnalysisSummary | null = null;
  expenses: ExpensesByCategory | null = null;
  cashFlow: CashFlow | null = null;

  loading = true;
  cashFlowLoading = false;
  errorMessage: string | null = null;
  cashFlowErrorMessage: string | null = null;
  validationMessage: string | null = null;

  constructor(
    private analysisService: AnalysisService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAnalysis();
  }

  get selectedPeriodLabel(): string | null {
    if (!this.summary) {
      return null;
    }

    return formatPeriodRangeLabel(this.summary.from_date, this.summary.to_date);
  }

  activePreset(): PeriodPresetId | null {
    return activePeriodPreset(this.from, this.to);
  }

  applyPreset(preset: PeriodPresetId): void {
    const range = preset === 'this-month' ? thisMonthRange() : lastMonthRange();
    this.from = range.from;
    this.to = range.to;
    this.fromDisplay = toEuropeanDate(this.from);
    this.toDisplay = toEuropeanDate(this.to);
    this.validationMessage = null;
    this.loadAnalysis();
  }

  summaryFlowBars(block: CurrencyAnalysisTotals) {
    return incomeExpenseBarWidths(block.total_income, block.total_expenses);
  }

  netSignLabel(netCashFlow: string): string {
    return netCashFlowSignLabel(netCashFlow);
  }

  categoryBarWidth(percentage: string): number {
    return categoryShareBarWidth(percentage);
  }

  cashFlowSparkBars(block: CurrencyCashFlow) {
    return cashFlowNetSparkBars(block.periods);
  }

  isLatestCashFlowPeriod(
    block: CurrencyCashFlow,
    period: CashFlowPeriod,
  ): boolean {
    return latestPeriodKey(block.periods) === period.period;
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

    if (this.to > this.maxTo) {
      this.validationMessage = 'To must not be in the future.';
      this.changeDetector.detectChanges();
      return;
    }

    this.validationMessage = null;
    this.loadAnalysis();
  }

  onGroupByChange(groupBy: string): void {
    if (groupBy !== 'day' && groupBy !== 'month') {
      return;
    }

    this.groupBy = groupBy;
    this.loadCashFlow();
  }

  private loadAnalysis(): void {
    this.loading = true;
    this.errorMessage = null;
    this.cashFlowErrorMessage = null;

    forkJoin({
      summary: this.analysisService.getSummary(this.from, this.to),
      expenses: this.analysisService.getExpenses(this.from, this.to),
      cashFlow: this.analysisService.getCashFlow(
        this.from,
        this.to,
        this.groupBy,
      ),
    }).subscribe({
      next: ({ summary, expenses, cashFlow }) => {
        this.summary = summary;
        this.expenses = expenses;
        this.cashFlow = cashFlow;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Unable to load the analysis data.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadCashFlow(): void {
    this.cashFlowLoading = true;
    this.cashFlowErrorMessage = null;

    this.analysisService
      .getCashFlow(this.from, this.to, this.groupBy)
      .subscribe({
        next: (cashFlow: CashFlow) => {
          this.cashFlow = cashFlow;
          this.cashFlowLoading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          this.cashFlowErrorMessage = 'Unable to load the cash flow.';
          this.cashFlowLoading = false;
          this.changeDetector.markForCheck();
        },
      });
  }
}
