import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { AnalysisSummary } from '../analysis/analysis-summary';
import { AnalysisService } from '../analysis/analysis.service';
import { ForecastResponse } from '../forecast/forecast-response';
import { ForecastService } from '../forecast/forecast.service';
import { FinancialGoal } from '../goals/goal';
import { GoalService } from '../goals/goal.service';
import { PersonalFinance } from './personal-finance';

describe('PersonalFinance', () => {
  const sampleAccounts: Account[] = [
    {
      id: 1,
      name: 'Demo Main Account',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '5000.00',
      created_at: '2026-01-01T00:00:00',
    },
  ];

  const emptyMonthSummary: AnalysisSummary = {
    from_date: '2026-10-01',
    to_date: '2026-10-05',
    total_income: '0.00',
    total_expenses: '0.00',
    net_cash_flow: '0.00',
  };

  const positiveSummary: AnalysisSummary = {
    from_date: '2026-09-01',
    to_date: '2026-09-30',
    total_income: '2000.00',
    total_expenses: '1350.00',
    net_cash_flow: '650.00',
  };

  const increasingForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    currency: 'EUR',
    group_by: 'month',
    periods: [
      {
        period: '2026-10',
        income: '2000.00',
        expenses: '1250.00',
        net_cash_flow: '750.00',
        projected_balance: '5750.00',
      },
      {
        period: '2026-11',
        income: '2000.00',
        expenses: '1250.00',
        net_cash_flow: '750.00',
        projected_balance: '6500.00',
      },
      {
        period: '2026-12',
        income: '2000.00',
        expenses: '1250.00',
        net_cash_flow: '750.00',
        projected_balance: '7250.00',
      },
    ],
  };

  const flatForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    currency: 'EUR',
    group_by: 'month',
    periods: [
      {
        period: '2026-10',
        income: '1250.00',
        expenses: '1250.00',
        net_cash_flow: '0.00',
        projected_balance: '5000.00',
      },
    ],
  };

  const noIncomeForecast: ForecastResponse = {
    from_date: '2026-10-05',
    to_date: '2026-12-31',
    currency: 'EUR',
    group_by: 'month',
    periods: [
      {
        period: '2026-10',
        income: '0.00',
        expenses: '0.00',
        net_cash_flow: '0.00',
        projected_balance: '5000.00',
      },
    ],
  };

  const goalWithoutAllocations: FinancialGoal = {
    id: 1,
    name: 'Emergency fund',
    target_amount: '1000.00',
    currency: 'EUR',
    target_date: null,
    created_at: '2026-10-01T00:00:00',
    allocations: [],
    current_amount: null,
    progress: null,
    completed: null,
  };

  let listAccounts: ReturnType<typeof vi.fn>;
  let getSummary: ReturnType<typeof vi.fn>;
  let getForecast: ReturnType<typeof vi.fn>;
  let listGoals: ReturnType<typeof vi.fn>;

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
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));
    getSummary = vi.fn().mockReturnValue(of(emptyMonthSummary));
    getForecast = vi.fn().mockReturnValue(of(increasingForecast));
    listGoals = vi.fn().mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [PersonalFinance],
      providers: [
        provideRouter([
          { path: 'personal_finance', component: PersonalFinance },
          {
            path: 'personal_finance/analysis',
            component: PersonalFinance,
          },
          {
            path: 'personal_finance/forecast',
            component: PersonalFinance,
          },
        ]),
        {
          provide: AccountService,
          useValue: { listAccounts },
        },
        {
          provide: AnalysisService,
          useValue: { getSummary },
        },
        {
          provide: ForecastService,
          useValue: { getForecast },
        },
        {
          provide: GoalService,
          useValue: { listGoals },
        },
      ],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Dashboard heading', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Dashboard');
  });

  it('should request accounts, analysis summary, and forecast on init', () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    const analysisRange = currentMonthRange();
    const forecastRange = defaultForecastRange();

    expect(listAccounts).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledWith(
      analysisRange.from,
      analysisRange.to,
    );
    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(getForecast).toHaveBeenCalledWith(
      forecastRange.from,
      forecastRange.to,
      'month',
    );
    expect(listGoals).toHaveBeenCalledTimes(1);
  });

  it('should render the current balance from account data', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Current financial position');
    expect(text).toContain('5,000.00');
    expect(text).toContain('Across your accounts');
    expect(text).toContain('Current position, not a forecast.');
  });

  it('should navigate to Analysis from feature discovery', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector(
      'a[href="/personal_finance/analysis"]',
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('Understand your finances');

    link?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/personal_finance/analysis');
  });

  it('should navigate to Forecast from feature discovery', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector(
      'a[href="/personal_finance/forecast"]',
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('Plan ahead');

    link?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/personal_finance/forecast');
  });

  it('should render a valid financial signal when the data supports it', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Financial signals');
    expect(text).toContain('Balance projected to increase');
    expect(text).not.toContain('Positive cash flow');
    expect(text).not.toContain('No immediate signals');
  });

  it('should render a historical cash-flow signal when the summary supports it', async () => {
    getSummary.mockReturnValue(of(positiveSummary));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Positive cash flow');
    expect(compiled.textContent).toContain(
      'Your income is currently higher than your expenses.',
    );
  });

  it('should show a neutral state when there is insufficient signal data', async () => {
    getForecast.mockReturnValue(of(flatForecast));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('No directional signals');
    expect(text).toContain(
      'Checked recorded cash flow from 01-10-2026 to 05-10-2026: no income or expenses were recorded.',
    );
    expect(text).toContain(
      'Checked the forecast from 05-10-2026 to 31-12-2026: scheduled income is present and the projected balance is unchanged.',
    );
    expect(text).not.toContain('Nothing currently requires your attention.');
    expect(text).not.toContain('Positive cash flow');
    expect(text).not.toContain('Balance projected to increase');
    expect(text).not.toContain('No scheduled income');
  });

  it('should show no scheduled income without fabricating a cash-flow signal', async () => {
    getForecast.mockReturnValue(
      of({
        ...noIncomeForecast,
        periods: [
          {
            period: '2026-10',
            income: '0.00',
            expenses: '100.00',
            net_cash_flow: '-100.00',
            projected_balance: '4900.00',
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('No scheduled income');
    expect(text).toContain('Balance projected to decrease');
    expect(text).not.toContain('Positive cash flow');
    expect(text).not.toContain('No directional signals');
  });

  it('should show loading until the dashboard data arrives', async () => {
    const pendingAccounts = new Subject<Account[]>();
    const pendingSummary = new Subject<AnalysisSummary>();
    const pendingForecast = new Subject<ForecastResponse>();
    const pendingGoals = new Subject<FinancialGoal[]>();
    listAccounts.mockReturnValue(pendingAccounts.asObservable());
    getSummary.mockReturnValue(pendingSummary.asObservable());
    getForecast.mockReturnValue(pendingForecast.asObservable());
    listGoals.mockReturnValue(pendingGoals.asObservable());

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.accountsLoading).toBe(true);
    expect(component.analysisLoading).toBe(true);
    expect(component.forecastLoading).toBe(true);
    expect(component.goalsLoading).toBe(true);
    expect(compiled.textContent).toContain('Loading current position...');
    expect(compiled.textContent).toContain('Loading financial signals...');
    expect(compiled.textContent).toContain('Loading goals...');
    expect(compiled.textContent).not.toContain('5,000.00');
    expect(compiled.textContent).toContain('Understand your finances');

    pendingAccounts.next(sampleAccounts);
    pendingAccounts.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(compiled.textContent).toContain('5,000.00');
    expect(compiled.textContent).toContain('Loading recorded cash flow...');
    expect(compiled.textContent).toContain('Loading the scheduled forecast...');
    expect(compiled.textContent).toContain('Loading goals...');
    expect(compiled.textContent).not.toContain('Balance projected to increase');

    pendingSummary.next(emptyMonthSummary);
    pendingSummary.complete();
    pendingForecast.next(increasingForecast);
    pendingForecast.complete();
    pendingGoals.next([]);
    pendingGoals.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(component.accountsLoading).toBe(false);
    expect(component.goalsLoading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading current position...');
    expect(compiled.textContent).not.toContain('Loading goals...');
    expect(compiled.textContent).toContain('5,000.00');
    expect(compiled.textContent).toContain('Balance projected to increase');
    expect(compiled.textContent).toContain('No financial goals yet.');
  });

  it('should show an error state without a misleading balance', async () => {
    listAccounts.mockReturnValue(throwError(() => new Error('network')));
    getSummary.mockReturnValue(throwError(() => new Error('network')));
    getForecast.mockReturnValue(throwError(() => new Error('network')));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('Unable to load your current balance.');
    expect(text).toContain(
      'Unable to load recorded cash flow for the current month.',
    );
    expect(text).toContain('Unable to load the scheduled forecast.');
    expect(text).not.toContain('5,000.00');
    expect(text).not.toContain('€0.00');
    expect(text).not.toContain('No directional signals');
    expect(text).toContain('No financial goals yet.');
  });

  it('should keep the balance when only signal requests fail', async () => {
    getSummary.mockReturnValue(throwError(() => new Error('network')));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('5,000.00');
    expect(text).toContain(
      'Unable to load recorded cash flow for the current month.',
    );
    expect(text).toContain('Balance projected to increase');
    expect(text).not.toContain('No directional signals');
    expect(text).not.toContain('Unable to load the scheduled forecast.');
  });

  it('should show an empty account state without fabricating a balance', async () => {
    listAccounts.mockReturnValue(of([]));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';
    expect(text).toContain('No accounts yet');
    expect(text).not.toContain('5,000.00');
    expect(text).not.toContain('€0.00');
    expect(text).not.toContain('Across your accounts');
  });

  it('should keep one total when every account uses the same currency', async () => {
    listAccounts.mockReturnValue(
      of([
        sampleAccounts[0],
        {
          ...sampleAccounts[0],
          id: 2,
          name: 'Cash',
          account_type: 'cash',
          current_balance: '250.50',
        },
      ]),
    );

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('5,250.50');
    expect(text).toContain('Across your accounts');
    expect(text).not.toContain('Totals stay separate by currency');
  });

  it('should total each currency separately and suppress currency-unsafe signals', async () => {
    listAccounts.mockReturnValue(
      of([
        sampleAccounts[0],
        {
          ...sampleAccounts[0],
          id: 2,
          name: 'Euro savings',
          current_balance: '1500.00',
        },
        {
          ...sampleAccounts[0],
          id: 3,
          name: 'Dollar account',
          currency: 'USD',
          current_balance: '40.00',
        },
      ]),
    );
    getSummary.mockReturnValue(of(positiveSummary));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('6,500.00');
    expect(text).toContain('EUR accounts');
    expect(text).toContain('40.00');
    expect(text).toContain('USD accounts');
    expect(text).toContain('Totals stay separate by currency');
    expect(text).not.toContain('6,540.00');
    expect(text).not.toContain('Across your accounts');
    expect(text).toContain(
      'Analysis and forecast signals are unavailable because your accounts use more than one currency.',
    );
    expect(text).not.toContain('Positive cash flow');
    expect(text).not.toContain('Balance projected to increase');
    expect(text).not.toContain('No directional signals');
  });

  it('should keep the forecast signal when analysis fails', async () => {
    getSummary.mockReturnValue(throwError(() => new Error('network')));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Balance projected to increase');
    expect(text).toContain(
      'Unable to load recorded cash flow for the current month.',
    );
    expect(text).not.toContain('Unable to load the scheduled forecast.');
  });

  it('should keep the cash-flow signal when the forecast fails', async () => {
    getSummary.mockReturnValue(of(positiveSummary));
    getForecast.mockReturnValue(throwError(() => new Error('network')));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Positive cash flow');
    expect(text).toContain('Unable to load the scheduled forecast.');
    expect(text).not.toContain('Balance projected to increase');
    expect(text).not.toContain(
      'Unable to load recorded cash flow for the current month.',
    );
    expect(text).toContain('5,000.00');
  });

  it('should keep balance and signals when goals fail to load', async () => {
    listGoals.mockReturnValue(throwError(() => new Error('network')));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('5,000.00');
    expect(text).toContain('Balance projected to increase');
    expect(text).toContain('Unable to load financial goals.');
    expect(text).not.toContain('No financial goals yet.');
    expect(text).not.toContain('Progress unavailable');
  });

  it('should show an empty goal list without inventing progress', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No financial goals yet.');
    expect(text).not.toContain('Progress unavailable');
    expect(text).not.toContain('0%');
  });

  it('should show unavailable progress when a goal has no allocations', async () => {
    listGoals.mockReturnValue(of([goalWithoutAllocations]));

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Emergency fund');
    expect(text).toContain('1,000.00');
    expect(text).toContain('Progress unavailable');
    expect(text).toContain('No allocations yet.');
    expect(text).not.toContain('0%');
    expect(text).not.toContain('not fully funded');
  });

  it('should flag an allocation that is only partly funded', async () => {
    listGoals.mockReturnValue(
      of([
        {
          ...goalWithoutAllocations,
          name: 'House deposit',
          target_amount: '1000.00',
          allocations: [
            {
              id: 9,
              goal_id: 1,
              account_id: 1,
              amount: '1000.00',
              funded_amount: '400.00',
              created_at: '2026-10-02T00:00:00',
            },
          ],
          current_amount: '400.00',
          progress: '0.40',
          completed: false,
        },
      ]),
    );

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('House deposit');
    expect(text).toContain('40%');
    expect(text).toContain('400.00');
    expect(text).toContain('Demo Main Account');
    expect(text).toContain('not fully funded');
    expect(text).toContain('1,000.00');
    expect(text).not.toContain('Progress unavailable');
    expect(text).not.toContain('No allocations yet.');
  });

  it('should show 0% when allocations exist but nothing is funded', async () => {
    listGoals.mockReturnValue(
      of([
        {
          ...goalWithoutAllocations,
          name: 'Vacation',
          target_amount: '500.00',
          allocations: [
            {
              id: 4,
              goal_id: 1,
              account_id: 1,
              amount: '500.00',
              funded_amount: '0.00',
              created_at: '2026-10-02T00:00:00',
            },
          ],
          current_amount: '0.00',
          progress: '0',
          completed: false,
        },
      ]),
    );

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Vacation');
    expect(text).toContain('0%');
    expect(text).toContain('0.00');
    expect(text).toContain('500.00');
    expect(text).toContain('not fully funded');
    expect(text).not.toContain('Progress unavailable');
    expect(text).not.toContain('No allocations yet.');
  });

  it('should link to Accounts, Transactions, Goals, Analysis, and Forecast', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const hrefs = [
      ...compiled.querySelectorAll('.discovery-card'),
    ].map((el) => el.getAttribute('href'));

    expect(hrefs).toEqual([
      '/personal_finance/accounts',
      '/personal_finance/transactions',
      '/personal_finance/goals',
      '/personal_finance/analysis',
      '/personal_finance/forecast',
    ]);
  });
});
