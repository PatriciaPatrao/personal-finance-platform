import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AnalysisService } from './analysis.service';
import {
  AnalysisSummary,
  CashFlow,
  CashFlowGroupBy,
  ExpensesByCategory,
} from './analysis-summary';

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
  selector: 'app-analysis',
  imports: [CurrencyPipe],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class Analysis implements OnInit {
  from = currentMonthRange().from;
  to = currentMonthRange().to;
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
