import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Forecast } from './forecast';
import { ForecastResponse } from './forecast-response';
import { ForecastService } from './forecast.service';

describe('Forecast', () => {
  const sampleForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    currency: 'EUR',
    group_by: 'month',
    periods: [
      {
        period: '2026-10',
        income: '2000.00',
        expenses: '1500.00',
        net_cash_flow: '500.00',
        projected_balance: '2500.00',
      },
      {
        period: '2026-11',
        income: '2000.00',
        expenses: '1500.00',
        net_cash_flow: '500.00',
        projected_balance: '3000.00',
      },
      {
        period: '2026-12',
        income: '2000.00',
        expenses: '1500.00',
        net_cash_flow: '500.00',
        projected_balance: '3500.00',
      },
    ],
  };

  let getForecast: ReturnType<typeof vi.fn>;

  function defaultForecastRange(): { from: string; to: string } {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const to = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    const toYear = to.getFullYear();
    const toMonth = String(to.getMonth() + 1).padStart(2, '0');
    const toDay = String(to.getDate()).padStart(2, '0');
    return {
      from: `${year}-${month}-${day}`,
      to: `${toYear}-${toMonth}-${toDay}`,
    };
  }

  beforeEach(async () => {
    getForecast = vi.fn().mockReturnValue(of(sampleForecast));

    await TestBed.configureTestingModule({
      imports: [Forecast],
      providers: [
        {
          provide: ForecastService,
          useValue: { getForecast },
        },
      ],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Forecast);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Forecast heading', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Forecast');
  });

  it('should initialise the date range from today through two months ahead', () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const expected = defaultForecastRange();

    expect(component.from).toBe(expected.from);
    expect(component.to).toBe(expected.to);
    expect(component.groupBy).toBe('month');

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

  it('should request the forecast on init with monthly grouping', () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    const expected = defaultForecastRange();

    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'month',
    );
  });

  it('should display forecast periods and projected balance', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Forecast overview');
    expect(text).toContain('Projected balance');
    expect(text).toContain('3,500.00');
    expect(text).toContain('Forecast periods');
    expect(text).toContain('2026-10');
    expect(text).toContain('2026-11');
    expect(text).toContain('2026-12');
    expect(text).toContain(
      'Projected balance combines the current account balance with future known income and recurring expenses.',
    );
  });

  it('should render zero-activity periods', async () => {
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        periods: [
          {
            period: '2026-10',
            income: '0.00',
            expenses: '0.00',
            net_cash_flow: '0.00',
            projected_balance: '1000.00',
          },
          {
            period: '2026-11',
            income: '0.00',
            expenses: '0.00',
            net_cash_flow: '0.00',
            projected_balance: '1000.00',
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('2026-10');
    expect(text).toContain('2026-11');
    expect(text).toContain('1,000.00');
  });

  it('should show loading until the forecast arrives', async () => {
    const pending = new Subject<ForecastResponse>();
    getForecast.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading forecast...');

    pending.next(sampleForecast);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(component.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading forecast...');
  });

  it('should show a user-facing error when the request fails', async () => {
    getForecast.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Unable to load the forecast.');
    expect(text).not.toContain('Internal Server Error');
  });

  it('should not request forecast when Apply has from after to', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();

    const component = fixture.componentInstance;
    component.fromDisplay = '10-10-2026';
    component.toDisplay = '01-10-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(getForecast).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('From must be on or before To.');
  });

  it('should request forecast for the selected dates when Apply is clicked', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();

    const component = fixture.componentInstance;
    component.fromDisplay = '01-11-2026';
    component.toDisplay = '30-11-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(getForecast).toHaveBeenCalledWith(
      '2026-11-01',
      '2026-11-30',
      'month',
    );
  });

  it('should request forecast again when grouping changes', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();

    const component = fixture.componentInstance;
    const expected = defaultForecastRange();
    component.onGroupByChange('day');
    await fixture.whenStable();

    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'day',
    );
    expect(component.groupBy).toBe('day');
  });
});
