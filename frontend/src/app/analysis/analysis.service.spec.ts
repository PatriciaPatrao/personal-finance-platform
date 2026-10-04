import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalysisSummary } from './analysis-summary';
import { AnalysisService } from './analysis.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnalysisService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request the analysis summary for a date range', () => {
    const expected: AnalysisSummary = {
      from_date: '2026-09-01',
      to_date: '2026-09-30',
      total_income: '2000.00',
      total_expenses: '1350.00',
      net_cash_flow: '650.00',
    };

    let actual: AnalysisSummary | undefined;
    service.getSummary('2026-09-01', '2026-09-30').subscribe((summary) => {
      actual = summary;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/analysis/summary?from=2026-09-01&to=2026-09-30',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.url).toBe('http://127.0.0.1:8000/analysis/summary');
    expect(request.request.params.get('from')).toBe('2026-09-01');
    expect(request.request.params.get('to')).toBe('2026-09-30');

    request.flush(expected);

    expect(actual).toEqual(expected);
    expect(actual?.total_income).toBe('2000.00');
    expect(actual?.total_expenses).toBe('1350.00');
    expect(actual?.net_cash_flow).toBe('650.00');
  });
});
