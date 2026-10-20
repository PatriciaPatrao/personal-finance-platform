import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AccountService } from '../accounts/account.service';
import { Forecast } from './forecast';
import { ForecastResponse } from './forecast-response';
import { ForecastService } from './forecast.service';

describe('Forecast', () => {
  const samplePeriods = [
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
  ];

  const sampleForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    scope: 'household',
    account_id: null,
    group_by: 'month',
    projections: [
      {
        currency: 'EUR',
        group_by: 'month',
        starting_balance: '2000.00',
        periods: samplePeriods,
      },
    ],
  };

  const multiCurrencyForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    scope: 'household',
    account_id: null,
    group_by: 'month',
    projections: [
      {
        currency: 'EUR',
        group_by: 'month',
        starting_balance: '2000.00',
        periods: [
          {
            period: '2026-10',
            income: '100.00',
            expenses: '0.00',
            net_cash_flow: '100.00',
            projected_balance: '2100.00',
          },
        ],
      },
      {
        currency: 'USD',
        group_by: 'month',
        starting_balance: '500.00',
        periods: [
          {
            period: '2026-10',
            income: '0.00',
            expenses: '50.00',
            net_cash_flow: '-50.00',
            projected_balance: '450.00',
          },
        ],
      },
    ],
  };

  let getForecast: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;

  const mixedCurrencyAccounts = [
    {
      id: 1,
      name: 'Euro main',
      account_type: 'bank' as const,
      currency: 'EUR',
      current_balance: '2000.00',
      created_at: '2026-01-01T00:00:00',
    },
    {
      id: 2,
      name: 'Dollar side',
      account_type: 'bank' as const,
      currency: 'USD',
      current_balance: '500.00',
      created_at: '2026-01-01T00:00:00',
    },
  ];

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
    listAccounts = vi.fn().mockReturnValue(
      of([
        {
          id: 1,
          name: 'Main',
          account_type: 'bank',
          currency: 'EUR',
          current_balance: '2000.00',
          created_at: '2026-01-01T00:00:00',
        },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [Forecast],
      providers: [
        {
          provide: ForecastService,
          useValue: { getForecast },
        },
        {
          provide: AccountService,
          useValue: { listAccounts },
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
    expect(component.groupByForCurrency('EUR')).toBe('month');

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
      undefined,
      undefined,
    );
  });

  it('should show the balance sparkline for monthly grouping with distinct bar heights', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const projection = component.displayProjections[0];
    expect(component.showBalanceSparkline(projection)).toBe(true);
    expect(component.balanceSparkTrend(projection)).toBe('rising');

    const root = fixture.nativeElement as HTMLElement;
    const sparkline = root.querySelector('.balance-sparkline');
    expect(sparkline).not.toBeNull();
    expect(sparkline?.classList.contains('balance-sparkline-rising')).toBe(
      true,
    );
    expect(sparkline?.getAttribute('aria-label')).toBe(
      'EUR projected balance trend, rising',
    );

    const accessibleSummary = root.querySelector(
      '.balance-sparkline .visually-hidden',
    );
    expect(accessibleSummary?.textContent).toContain('2026-10');
    expect(accessibleSummary?.textContent).toContain('2026-12');
    expect(accessibleSummary?.textContent).toMatch(/3[,.]500\.00|3\.500,00/);

    const bars = root.querySelectorAll('.balance-spark-bars .balance-spark-bar');
    expect(bars.length).toBe(3);
    const heights = Array.from(bars).map(
      (bar) => (bar as HTMLElement).style.height,
    );
    expect(heights[0]).not.toBe(heights[2]);
    expect(parseFloat(heights[0])).toBeLessThan(parseFloat(heights[2]));
  });

  it('should expose a stable balance sparkline trend accessibly when balances are unchanged', async () => {
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        projections: [
          {
            ...sampleForecast.projections[0],
            periods: [
              {
                period: '2026-10',
                income: '0.00',
                expenses: '0.00',
                net_cash_flow: '0.00',
                projected_balance: '2000.00',
              },
              {
                period: '2026-11',
                income: '0.00',
                expenses: '0.00',
                net_cash_flow: '0.00',
                projected_balance: '2000.00',
              },
              {
                period: '2026-12',
                income: '0.00',
                expenses: '0.00',
                net_cash_flow: '0.00',
                projected_balance: '2000.00',
              },
            ],
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const projection = component.displayProjections[0];
    expect(component.balanceSparkTrend(projection)).toBe('stable');

    const sparkline = (fixture.nativeElement as HTMLElement).querySelector(
      '.balance-sparkline',
    );
    expect(sparkline?.getAttribute('aria-label')).toBe(
      'EUR projected balance trend, stable',
    );
    expect(sparkline?.classList.contains('balance-sparkline-stable')).toBe(
      true,
    );
  });

  it('should hide the balance sparkline when grouping is daily', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        group_by: 'day',
        projections: [
          {
            ...sampleForecast.projections[0],
            group_by: 'day',
            periods: [
              {
                period: '2026-10-20',
                income: '100.00',
                expenses: '0.00',
                net_cash_flow: '100.00',
                projected_balance: '2100.00',
              },
              {
                period: '2026-10-21',
                income: '100.00',
                expenses: '0.00',
                net_cash_flow: '100.00',
                projected_balance: '2200.00',
              },
            ],
          },
        ],
      }),
    );

    const component = fixture.componentInstance;
    component.onGroupByChange('EUR', 'day');
    await fixture.whenStable();
    fixture.detectChanges();

    const projection = component.displayProjections[0];
    expect(component.groupByForCurrency('EUR')).toBe('day');
    expect(component.showBalanceSparkline(projection)).toBe(false);

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.balance-sparkline')).toBeNull();
  });

  it('should display forecast periods and ending projected balance', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('EUR forecast');
    expect(text).toContain('Ending projected balance');
    expect(text).toContain('3,500.00');
    expect(text).toContain('At 31 December 2026');
    expect(text).toContain('Forecast periods');
    expect(text).toContain('2026-10');
    expect(text).toContain('2026-11');
    expect(text).toContain('2026-12');
    expect(text).toContain('for EUR accounts');
    expect(text).toContain(
      'Each projected balance is the running balance after that period.',
    );
  });

  it('should show net income with positive and negative styling', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockReturnValue(of(multiCurrencyForecast));
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    const panels = root.querySelectorAll('.currency-projection-panel');

    expect(component.netIncome(multiCurrencyForecast.projections[0])).toBe(
      '100.00',
    );
    expect(
      component.isNetIncomePositive(multiCurrencyForecast.projections[0]),
    ).toBe(true);
    expect(component.netIncome(multiCurrencyForecast.projections[1])).toBe(
      '-50.00',
    );
    expect(
      component.isNetIncomePositive(multiCurrencyForecast.projections[1]),
    ).toBe(false);

    const eurNetIncome = panels[0]?.querySelector('.net-income-metric');
    const usdNetIncome = panels[1]?.querySelector('.net-income-metric');
    expect(eurNetIncome?.classList.contains('net-income-positive')).toBe(true);
    expect(usdNetIncome?.classList.contains('net-income-negative')).toBe(true);
    expect(root.textContent).toContain('Net change');
    expect(eurNetIncome?.textContent).toContain('Surplus');
    expect(eurNetIncome?.textContent).toContain('100.00');
    expect(usdNetIncome?.textContent).toContain('Deficit');
    expect(usdNetIncome?.textContent).toMatch(/-?\$50\.00/);
  });

  it('should highlight the current forecast period row', async () => {
    vi.setSystemTime(new Date(2026, 9, 20));
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        projections: [
          {
            currency: 'EUR',
            group_by: 'month',
            starting_balance: '2000.00',
            periods: [
              {
                period: '2026-10',
                income: '100.00',
                expenses: '0.00',
                net_cash_flow: '100.00',
                projected_balance: '2100.00',
              },
              {
                period: '2026-11',
                income: '0.00',
                expenses: '0.00',
                net_cash_flow: '0.00',
                projected_balance: '2100.00',
              },
            ],
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.period-current')).not.toBeNull();
    expect(root.textContent).toContain('Current period');
    expect(root.textContent).toContain('not guaranteed outcomes');
    vi.useRealTimers();
  });

  it('should derive starting balance from the first period', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    const projection = component.displayProjections[0];
    expect(projection.starting_balance).toBe('2000.00');
    expect(component.endingProjectedBalance(projection)).toBe('3500.00');
    expect(text).toContain('Starting balance');
    expect(text).toContain('2,000.00');
    expect(text).toContain('At the start of the forecast');
  });

  it('should handle empty periods safely', async () => {
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        projections: [
          {
            currency: 'EUR',
            group_by: 'month',
            starting_balance: '2000.00',
            periods: [],
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(component.displayProjections).toHaveLength(1);
    expect(
      component.endingProjectedBalance(component.displayProjections[0]),
    ).toBeNull();
    expect(component.endingProjectedBalanceDate).toBe('31 December 2026');
    expect(
      component.hasZeroSchedule(component.displayProjections[0]),
    ).toBe(false);
    expect(text).toContain('No forecast periods returned for this range.');
    expect(text).not.toContain('Starting balance');
    expect(text).not.toContain('Ending projected balance');
    expect(text).not.toContain(
      'Each projected balance is the running balance after that period.',
    );
  });

  it('should render zero-activity periods with the zero-schedule message', async () => {
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        projections: [
          {
            currency: 'EUR',
            group_by: 'month',
            starting_balance: '1000.00',
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
    expect(text).toContain(
      'No scheduled income or recurring expenses fall within this range, so the projected balance remains unchanged.',
    );
    expect(compiled.querySelector('.data-table')).not.toBeNull();
  });

  it('should not show the zero-schedule message when any period has activity', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).not.toContain(
      'No scheduled income or recurring expenses fall within this range, so the projected balance remains unchanged.',
    );
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
    fixture.detectChanges();
    getForecast.mockClear();

    const component = fixture.componentInstance;
    component.fromDisplay = '03-04-2027';
    component.toDisplay = '31-12-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const text = compiled.textContent ?? '';
    expect(getForecast).not.toHaveBeenCalled();
    expect(text).toContain('From must be on or before To.');
    expect(component.forecast).toBeNull();
    expect(component.displayProjections).toEqual([]);
    expect(text).not.toContain('3,500.00');
    expect(text).not.toContain('2026-10');
    expect(compiled.querySelector('.data-table')).toBeNull();
  });

  it('should request forecast for the selected dates when Apply is clicked', async () => {
    const nextForecast: ForecastResponse = {
      ...sampleForecast,
      from_date: '2026-11-01',
      to_date: '2026-11-30',
      projections: [
        {
          currency: 'EUR',
          group_by: 'month',
          starting_balance: '3350.00',
          periods: [
            {
              period: '2026-11',
              income: '2000.00',
              expenses: '1250.00',
              net_cash_flow: '750.00',
              projected_balance: '4100.00',
            },
          ],
        },
      ],
    };
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    getForecast.mockClear();
    getForecast.mockReturnValue(of(nextForecast));

    const component = fixture.componentInstance;
    component.fromDisplay = '01-11-2026';
    component.toDisplay = '30-11-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = compiled.textContent ?? '';
    expect(getForecast).toHaveBeenCalledWith(
      '2026-11-01',
      '2026-11-30',
      'month',
      undefined,
      undefined,
    );
    expect(text).toContain('2026-11');
    expect(text).toContain('4,100.00');
    expect(text).toContain('At 30 November 2026');
    expect(text).not.toContain('3,500.00');
    expect(text).not.toContain('2026-12');
  });

  it('should clear the previous forecast when the request fails', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    getForecast.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const component = fixture.componentInstance;
    component.fromDisplay = '01-11-2026';
    component.toDisplay = '30-11-2026';
    const compiled = fixture.nativeElement as HTMLElement;
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = compiled.textContent ?? '';
    expect(text).toContain('Unable to load the forecast.');
    expect(text).not.toContain('Internal Server Error');
    expect(component.forecast).toBeNull();
    expect(component.displayProjections).toEqual([]);
    expect(text).not.toContain('3,500.00');
    expect(compiled.querySelector('.data-table')).toBeNull();
  });

  it('should request forecast again when grouping changes', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();
    getForecast.mockReturnValue(
      of({
        ...sampleForecast,
        group_by: 'day',
        projections: [
          {
            ...sampleForecast.projections[0],
            group_by: 'day',
          },
        ],
      }),
    );

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const expected = defaultForecastRange();
    component.onGroupByChange('EUR', 'day');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'day',
      undefined,
      undefined,
    );
    expect(component.groupByForCurrency('EUR')).toBe('day');
    expect(component.forecast).not.toBeNull();
    expect(component.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading forecast...');
  });

  it('should keep the forecast visible while a grouping change reloads', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.forecast).not.toBeNull();

    getForecast.mockReturnValue(new Subject<ForecastResponse>().asObservable());
    component.onGroupByChange('EUR', 'day');
    fixture.detectChanges();

    expect(component.forecast).not.toBeNull();
    expect(component.loading).toBe(false);
    expect(component.isPeriodsUpdating('EUR')).toBe(true);
    expect(compiled.textContent).not.toContain('Loading forecast...');
    expect(compiled.textContent).toContain('Updating forecast periods...');
    expect(compiled.textContent).toContain('EUR forecast');
  });

  it('should use the last valid date range when grouping changes after a rejected range', async () => {
    const nextForecast: ForecastResponse = {
      ...sampleForecast,
      from_date: '2026-11-01',
      to_date: '2026-11-30',
      projections: [
        {
          currency: 'EUR',
          group_by: 'month',
          starting_balance: '3350.00',
          periods: [
            {
              period: '2026-11',
              income: '2000.00',
              expenses: '1250.00',
              net_cash_flow: '750.00',
              projected_balance: '4100.00',
            },
          ],
        },
      ],
    };
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    getForecast.mockClear();
    getForecast.mockReturnValue(of(nextForecast));

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    component.fromDisplay = '01-11-2026';
    component.toDisplay = '30-11-2026';
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    component.fromDisplay = '03-04-2027';
    component.toDisplay = '31-12-2026';
    (
      compiled.querySelector('.apply-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    getForecast.mockClear();
    getForecast.mockReturnValue(of(nextForecast));

    component.onGroupByChange('EUR', 'day');
    await fixture.whenStable();

    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      '2026-11-01',
      '2026-11-30',
      'day',
      undefined,
      undefined,
    );
    expect(component.from).toBe('2026-11-01');
    expect(component.to).toBe('2026-11-30');
  });

  it('should reload the forecast when the account filter changes', async () => {
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();

    const component = fixture.componentInstance;
    component.onAccountFilterChange('1');
    await fixture.whenStable();

    const expected = defaultForecastRange();
    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'month',
      1,
      undefined,
    );
  });

  it('should request per-currency grouping overrides for mixed forecasts', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockReturnValue(of(multiCurrencyForecast));
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    getForecast.mockClear();
    getForecast.mockReturnValue(
      of({
        ...multiCurrencyForecast,
        projections: [
          multiCurrencyForecast.projections[0],
          {
            ...multiCurrencyForecast.projections[1],
            group_by: 'day',
          },
        ],
      }),
    );

    const component = fixture.componentInstance;
    const expected = defaultForecastRange();
    component.onGroupByChange('USD', 'day');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getForecast).toHaveBeenCalledWith(
      expected.from,
      expected.to,
      'month',
      undefined,
      { USD: 'day' },
    );
    expect(component.groupByForCurrency('EUR')).toBe('month');
    expect(component.groupByForCurrency('USD')).toBe('day');
  });

  it('should request household forecast on init when accounts use mixed currencies', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockReturnValue(of(multiCurrencyForecast));
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getForecast).toHaveBeenCalledTimes(1);
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('EUR forecast');
    expect(text).toContain('USD forecast');
    expect(text).toContain('2,100.00');
    expect(text).toContain('450.00');
    expect(text).not.toContain('Unable to load the forecast.');
  });

  it('should render separate household sections without a combined total', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockReturnValue(of(multiCurrencyForecast));
    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.currency-projection-panel')).toHaveLength(2);
    const text = root.textContent ?? '';
    expect(text).not.toMatch(/2,550\.00/);
  });

  it('should load an account-scoped forecast when an account is selected', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    const accountForecast: ForecastResponse = {
      from_date: '2026-10-05',
      to_date: '2026-12-31',
      scope: 'account',
      account_id: 1,
      group_by: 'month',
      projections: [
        {
          currency: 'EUR',
          group_by: 'month',
          starting_balance: '2000.00',
          periods: [
            {
              period: '2026-10',
              income: '0.00',
              expenses: '0.00',
              net_cash_flow: '0.00',
              projected_balance: '2000.00',
            },
          ],
        },
      ],
    };
    getForecast.mockImplementation(
      (_from, _to, _groupBy, accountId?: number) => {
        if (accountId === 1) {
          return of(accountForecast);
        }
        return of(multiCurrencyForecast);
      },
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;
    component.onAccountFilterChange('1');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('.currency-projection-panel')).toHaveLength(1);
    expect(root.textContent).toContain('EUR forecast');
    expect(root.textContent).not.toContain('USD forecast');
  });

  it('should not show stale forecast data when switching accounts quickly', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    const slowAccount = new Subject<ForecastResponse>();
    const fastAccount: ForecastResponse = {
      from_date: '2026-10-05',
      to_date: '2026-12-31',
      scope: 'account',
      account_id: 2,
      group_by: 'month',
      projections: [
        {
          currency: 'USD',
          group_by: 'month',
          starting_balance: '500.00',
          periods: [
            {
              period: '2026-10',
              income: '0.00',
              expenses: '0.00',
              net_cash_flow: '0.00',
              projected_balance: '500.00',
            },
          ],
        },
      ],
    };

    getForecast.mockImplementation(
      (_from: string, _to: string, _groupBy: string, accountId?: number) => {
        if (accountId === 1) {
          return slowAccount.asObservable();
        }
        if (accountId === 2) {
          return of(fastAccount);
        }
        return of(multiCurrencyForecast);
      },
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    component.onAccountFilterChange('1');
    component.onAccountFilterChange('2');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('500.00');
    expect(root.textContent).not.toContain('2,000.00');

    slowAccount.next({
      from_date: '2026-10-05',
      to_date: '2026-12-31',
      scope: 'account',
      account_id: 1,
      group_by: 'month',
      projections: [
        {
          currency: 'EUR',
          group_by: 'month',
          starting_balance: '2000.00',
          periods: [
            {
              period: '2026-10',
              income: '0.00',
              expenses: '0.00',
              net_cash_flow: '0.00',
              projected_balance: '2000.00',
            },
          ],
        },
      ],
    });
    slowAccount.complete();
    fixture.detectChanges();

    expect(component.accountFilter).toBe('2');
    expect(root.textContent).toContain('500.00');
    expect(root.textContent).not.toContain('2,000.00');
  });

  it('should restore household projections when returning to All accounts', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockImplementation(
      (_from, _to, _groupBy, accountId?: number) => {
        if (accountId === 1) {
          return of({
            from_date: '2026-10-05',
            to_date: '2026-12-31',
            scope: 'account',
            account_id: 1,
            group_by: 'month',
            projections: [
              {
                currency: 'EUR',
                group_by: 'month',
                starting_balance: '2000.00',
                periods: [],
              },
            ],
          } satisfies ForecastResponse);
        }
        return of(multiCurrencyForecast);
      },
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance;
    component.onAccountFilterChange('1');
    await fixture.whenStable();
    fixture.detectChanges();

    component.onAccountFilterChange('all');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelectorAll('.currency-projection-panel')).toHaveLength(2);
    expect(root.textContent).toContain('USD forecast');
  });

  it('should show a generic error for unrelated API failures on account scope', async () => {
    listAccounts.mockReturnValue(of(mixedCurrencyAccounts));
    getForecast.mockImplementation(
      (_from: string, _to: string, _groupBy: string, accountId?: number) => {
        if (accountId === 1) {
          return throwError(() => new Error('network'));
        }
        return throwError(() => new Error('unexpected'));
      },
    );

    const fixture = TestBed.createComponent(Forecast);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onAccountFilterChange('1');
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Unable to load the forecast.');
    expect(root.querySelector('.status-error')).not.toBeNull();
    expect(root.querySelector('.data-table')).toBeNull();
  });
});
