import { CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { AnalysisService } from './analysis.service';
import { AnalysisSummary } from './analysis-summary';

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

@Component({
  selector: 'app-analysis',
  imports: [CurrencyPipe],
  templateUrl: './analysis.html',
  styleUrl: './analysis.scss',
})
export class Analysis implements OnInit {
  from = currentMonthRange().from;
  to = currentMonthRange().to;
  maxTo = formatDate(new Date());
  summary: AnalysisSummary | null = null;
  loading = true;
  errorMessage: string | null = null;
  validationMessage: string | null = null;

  constructor(
    private analysisService: AnalysisService,
    private changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  apply(): void {
    if (this.from > this.to) {
      this.validationMessage = 'From must be on or before To.';
      return;
    }

    if (this.to > this.maxTo) {
      this.validationMessage = 'To must not be in the future.';
      return;
    }

    this.validationMessage = null;
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading = true;
    this.errorMessage = null;
    this.analysisService.getSummary(this.from, this.to).subscribe({
      next: (summary: AnalysisSummary) => {
        this.summary = summary;
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Unable to load the analysis summary.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}
