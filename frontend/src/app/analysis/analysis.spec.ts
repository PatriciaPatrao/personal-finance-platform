import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Analysis } from './analysis';
import { AnalysisService } from './analysis.service';
import {
  AnalysisSummary,
  CashFlow,
  ExpensesByCategory,
} from './analysis-summary';

describe('Analysis', () => {
  const sampleSummary: AnalysisSummary = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    total_income: '2000.00',
    total_expenses: '1350.00',
    net_cash_flow: '650.00',
  };

  const sampleExpenses: ExpensesByCategory = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    total_expenses: '1350.00',
    categories: [
      {
        category: 'Housing',
        amount: '800.00',
        percentage: '59.26',
      },
      {
        category: 'Food',
        amount: '350.00',
        percentage: '25.93',
      },
    ],
  };

  const sampleCashFlow: CashFlow = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    group_by: 'month',
    periods: [
      {
        period: '2026-09',
        income: '2000.00',
        expenses: '1350.00',
        net_cash_flow: '650.00',
      },
    ],
  };

  let getSummary: ReturnType<typeof vi.fn>;
  let getExpenses: ReturnType<typeof vi.fn>;
  let getCashFlow: ReturnType<typeof vi.fn>;

  function currentMonthRange(): { from: string; to: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${day}`,
    };
  }

  beforeEach(async () => {
    getSummary = vi.fn().mockReturnValue(of(sampleSummary));
    getExpenses = vi.fn().mockReturnValue(of(sampleExpenses));
    getCashFlow = vi.fn().mockReturnValue(of(sampleCashFlow));

    await TestBed.configureTestingModule({
      imports: [Analysis],
      providers: [
        {
          provide: AnalysisService,
          useValue: { getSummary, getExpenses, getCashFlow },
        },
      ],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Analysis);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Analysis heading', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Analysis');
  });

  it('should initialise the date range to the current calendar month', () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const expected = currentMonthRange();

    expect(component.from).toBe(expected.from);
    expect(component.to).toBe(expected.to);

    const [fromYear, fromMonth, fromDay] = expected.from.split('-');
    const [toYear, toMonth, toDay] = expected.to.split('-');
    const compiled = fixture.nativeElement as HTMLElement;
    const inputs = compiled.querySelectorAll('input');
    expect(inputs[0]?.getAttribute('placeholder')).toBe('DD-MM-YYYY');
    expect((inputs[0] as HTMLInputElement).value).toBe(
      `${fromDay}-${fromMonth}-${fromYear}`,
    );
    expect((inputs[1] as HTMLInputElement).value).toBe(
      `${toDay}-${toMonth}-${toYear}`,
    );
  });

  it('should request summary, expenses, and cash flow on init', () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    const expected = currentMonthRange();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledWith(expected.from, expected.to);
    expect(getExpenses).toHaveBeenCalledTimes(1);
    expect(getExpenses).toHaveBeenCalledWith(expected.from, expected.to);
    expect(getCashFlow).toHaveBeenCalledTimes(1);
    expect(getCashFlow).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'month',
    );
  });

  it('should display summary, expenses, and cash flow responses', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Summary');
    expect(text).toContain('Income');
    expect(text).toContain('2,000.00');
    expect(text).toContain('Expenses by Category');
    expect(text).toContain('Housing');
    expect(text).toContain('59.26%');
    expect(text).toContain('Cash Flow Over Time');
    expect(text).toContain('2026-09');
  });

  it('should show an empty expenses state when there are no categories', async () => {
    getExpenses.mockReturnValue(
      of({
        ...sampleExpenses,
        total_expenses: '0.00',
        categories: [],
      }),
    );

    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      'No expenses recorded for this period.',
    );
  });

  it('should show loading until the analysis arrives', async () => {
    const pendingSummary = new Subject<AnalysisSummary>();
    const pendingExpenses = new Subject<ExpensesByCategory>();
    const pendingCashFlow = new Subject<CashFlow>();
    getSummary.mockReturnValue(pendingSummary.asObservable());
    getExpenses.mockReturnValue(pendingExpenses.asObservable());
    getCashFlow.mockReturnValue(pendingCashFlow.asObservable());

    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading analysis...');

    pendingSummary.next(sampleSummary);
    pendingSummary.complete();
    pendingExpenses.next(sampleExpenses);
    pendingExpenses.complete();
    pendingCashFlow.next(sampleCashFlow);
    pendingCashFlow.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(component.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading analysis...');
  });

  it('should show a user-facing error when the request fails', async () => {
    getSummary.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Unable to load the analysis data.');
    expect(text).not.toContain('Internal Server Error');
  });

  it('should not request analysis when Apply has from after to', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getSummary.mockClear();
    getExpenses.mockClear();
    getCashFlow.mockClear();

    const component = fixture.componentInstance;
    component.fromDisplay = '10-10-2026';
    component.toDisplay = '01-10-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(getSummary).not.toHaveBeenCalled();
    expect(getExpenses).not.toHaveBeenCalled();
    expect(getCashFlow).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('From must be on or before To.');
  });

  it('should not request analysis when Apply has to in the future', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getSummary.mockClear();
    getExpenses.mockClear();
    getCashFlow.mockClear();

    const component = fixture.componentInstance;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const future = `${day}-${month}-${year}`;
    const start = currentMonthRange().from.split('-');

    component.fromDisplay = `${start[2]}-${start[1]}-${start[0]}`;
    component.toDisplay = future;
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(getSummary).not.toHaveBeenCalled();
    expect(getExpenses).not.toHaveBeenCalled();
    expect(getCashFlow).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('To must not be in the future.');
  });

  it('should fill From from the calendar without losing typed dates', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.fromDisplay = '15-09-2026';
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector(
        'button[aria-label="Open calendar for From"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    let summary = 'unchecked';
    try {
      const monthLabel =
        compiled.querySelector('.month-label')?.textContent?.trim() ?? '';
      expect(monthLabel).toBe('September 2026');

      (
        compiled.querySelector(
          '[data-date="2026-09-01"]',
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      const fromInput = compiled.querySelector(
        'input[name="from"]',
      ) as HTMLInputElement;
      expect(component.fromDisplay).toBe('01-09-2026');
      expect(fromInput.value).toBe('01-09-2026');
      expect(compiled.querySelector('#from-calendar') === null).toBe(true);
      summary = 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary = message.slice(0, 180);
    }
    const xhr = new XMLHttpRequest();
    xhr.open(
      'GET',
      `http://127.0.0.1:9876/debug?m=${encodeURIComponent(summary)}`,
      false,
    );
    xhr.send();
    expect(summary).toBe('ok');
  });

  it('should request analysis for the selected dates when Apply is clicked', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getSummary.mockClear();
    getExpenses.mockClear();
    getCashFlow.mockClear();

    const component = fixture.componentInstance;
    component.fromDisplay = '01-09-2026';
    component.toDisplay = '30-09-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(getSummary).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
    expect(getExpenses).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
    expect(getCashFlow).toHaveBeenCalledWith(
      '2026-09-01',
      '2026-09-30',
      'month',
    );
  });

  it('should request cash flow again when grouping changes', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getCashFlow.mockClear();

    const component = fixture.componentInstance;
    const expected = currentMonthRange();
    component.onGroupByChange('day');
    await fixture.whenStable();

    expect(getCashFlow).toHaveBeenCalledTimes(1);
    expect(getCashFlow).toHaveBeenCalledWith(expected.from, expected.to, 'day');
    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getExpenses).toHaveBeenCalledTimes(1);
  });
});
