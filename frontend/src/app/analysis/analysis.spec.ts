import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Analysis } from './analysis';
import { AnalysisService } from './analysis.service';
import { AnalysisSummary } from './analysis-summary';

describe('Analysis', () => {
  const sampleSummary: AnalysisSummary = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    total_income: '2000.00',
    total_expenses: '1350.00',
    net_cash_flow: '650.00',
  };

  let getSummary: ReturnType<typeof vi.fn>;

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

    await TestBed.configureTestingModule({
      imports: [Analysis],
      providers: [
        { provide: AnalysisService, useValue: { getSummary } },
      ],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Analysis);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
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
  });

  it('should request the summary for the current month on init', () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    const expected = currentMonthRange();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledWith(expected.from, expected.to);
  });

  it('should display a successful summary response', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Income');
    expect(text).toContain('Expenses');
    expect(text).toContain('Net Cash Flow');
    expect(text).toContain('2,000.00');
    expect(text).toContain('1,350.00');
    expect(text).toContain('650.00');
  });

  it('should show loading until the summary arrives', async () => {
    const pending = new Subject<AnalysisSummary>();
    getSummary.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading...');

    pending.next(sampleSummary);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(component.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading...');
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
    expect(text).toContain('Unable to load the analysis summary.');
    expect(text).not.toContain('Internal Server Error');
  });

  it('should not request the summary when Apply has from after to', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getSummary.mockClear();

    const component = fixture.componentInstance;
    component.from = '2026-10-10';
    component.to = '2026-10-01';
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector('button')?.click();
    fixture.detectChanges();

    expect(getSummary).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('From must be on or before To.');
  });

  it('should request the summary for the selected dates when Apply is clicked', async () => {
    const fixture = TestBed.createComponent(Analysis);
    fixture.detectChanges();
    await fixture.whenStable();
    getSummary.mockClear();

    const component = fixture.componentInstance;
    component.from = '2026-09-01';
    component.to = '2026-09-30';
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector('button')?.click();
    await fixture.whenStable();

    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
  });
});
