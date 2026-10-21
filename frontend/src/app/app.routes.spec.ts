import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, Router } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { PfpPreset } from './design-system/pfp-preset';

import { AccountService } from './accounts/account.service';
import { AnalysisService } from './analysis/analysis.service';
import { pageTitle } from './app-page-titles';
import { App } from './app';
import { routes } from './app.routes';
import { ForecastService } from './forecast/forecast.service';
import { GoalService } from './goals/goal.service';
import { IncomeService } from './schedules/income.service';
import { RecurringExpenseService } from './schedules/recurring-expense.service';
import { TransactionService } from './transactions/transactions.service';

describe('App routing', { timeout: 20_000 }, () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideAnimationsAsync(),
        providePrimeNG({
          theme: {
            preset: PfpPreset,
            options: { prefix: 'p', darkModeSelector: false },
          },
        }),
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated$: of(true),
            user$: of({ sub: 'test-user' }),
            loginWithRedirect: () => of(undefined),
            logout: () => of(undefined),
            getAccessTokenSilently: () => of('test-token'),
          },
        },
        {
          provide: AccountService,
          useValue: {
            listAccounts: () =>
              of([
                {
                  id: 1,
                  name: 'Demo Main Account',
                  account_type: 'bank',
                  currency: 'EUR',
                  current_balance: '5000.00',
                  created_at: '2026-01-01T00:00:00',
                },
              ]),
            createAccount: () =>
              of({
                id: 1,
                name: 'Demo Main Account',
                account_type: 'bank',
                currency: 'EUR',
                current_balance: '5000.00',
                created_at: '2026-01-01T00:00:00',
              }),
            getAccount: () =>
              of({
                id: 1,
                name: 'Demo Main Account',
                account_type: 'bank',
                currency: 'EUR',
                current_balance: '5000.00',
                created_at: '2026-01-01T00:00:00',
              }),
          },
        },
        {
          provide: AnalysisService,
          useValue: {
            getSummary: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                by_currency: [],
              }),
            getExpenses: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                currencies: [],
              }),
            getCashFlow: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                group_by: 'month',
                currencies: [],
              }),
          },
        },
        {
          provide: ForecastService,
          useValue: {
            getForecast: () =>
              of({
                from_date: '2026-10-05',
                to_date: '2026-12-31',
                scope: 'household',
                account_id: null,
                group_by: 'month',
                projections: [
                  {
                    currency: 'EUR',
                    group_by: 'month',
                    starting_balance: '5000.00',
                    periods: [
                      {
                        period: '2026-10',
                        income: '2000.00',
                        expenses: '1250.00',
                        net_cash_flow: '750.00',
                        projected_balance: '5750.00',
                      },
                    ],
                  },
                ],
              }),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            listTransactions: () => of([]),
          },
        },
        {
          provide: GoalService,
          useValue: {
            listGoals: () => of([]),
          },
        },
        {
          provide: IncomeService,
          useValue: {
            listIncomes: () => of([]),
          },
        },
        {
          provide: RecurringExpenseService,
          useValue: {
            listRecurringExpenses: () => of([]),
          },
        },
      ],
    }).compileComponents();
  });

  async function renderAt(url: string): Promise<{
    compiled: HTMLElement;
    router: Router;
  }> {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      compiled: fixture.nativeElement as HTMLElement,
      router,
    };
  }

  function navHrefs(compiled: HTMLElement): (string | null)[] {
    return [
      ...compiled.querySelectorAll(
        'nav[aria-label="Primary"] a.p-menubar-item-link',
      ),
    ].map((el) => el.getAttribute('href'));
  }

  function activeNavHref(compiled: HTMLElement): string | null {
    return (
      compiled
        .querySelector('nav[aria-label="Primary"] a.p-menubar-item-link.active-nav')
        ?.getAttribute('href') ?? null
    );
  }

  it('redirects / to /personal_finance', async () => {
    const { compiled, router } = await renderAt('/');
    expect(router.url).toBe('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Dashboard',
    );
  });

  it('should expose a skip link to the main content landmark', async () => {
    const { compiled } = await renderAt('/personal_finance');
    const skipLink = compiled.querySelector(
      'a.skip-link',
    ) as HTMLAnchorElement | null;
    const main = compiled.querySelector('main#main-content');

    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(skipLink?.textContent).toContain('Skip to main content');
    expect(main).toBeTruthy();
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('should focus main content when the skip link is activated', async () => {
    const { compiled } = await renderAt('/personal_finance');
    const skipLink = compiled.querySelector(
      'a.skip-link',
    ) as HTMLAnchorElement | null;
    const main = compiled.querySelector(
      'main#main-content',
    ) as HTMLElement | null;

    expect(skipLink).toBeTruthy();
    expect(main).toBeTruthy();
    skipLink?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.activeElement).toBe(main);
  });

  it('should label primary navigation for assistive technologies', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(compiled.querySelector('nav[aria-label="Primary"]')).toBeTruthy();
  });

  it('should set a meaningful document title on the Dashboard', async () => {
    await renderAt('/personal_finance');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Dashboard — Personal Finance Platform',
    );
  });

  it('should set route-specific document titles', async () => {
    await renderAt('/personal_finance/analysis');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Analysis — Personal Finance Platform',
    );

    await renderAt('/personal_finance/transactions');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Transactions — Personal Finance Platform',
    );
  });

  it('should set the account name in the document title on account detail', async () => {
    await renderAt('/personal_finance/accounts/1');
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Demo Main Account — Personal Finance Platform',
    );
  });

  it('should set document titles for every child route', async () => {
    const cases: [string, string][] = [
      ['/personal_finance', 'Dashboard'],
      ['/personal_finance/accounts', 'Accounts'],
      ['/personal_finance/schedules', 'Schedules'],
      ['/personal_finance/goals', 'Goals'],
      ['/personal_finance/analysis', 'Analysis'],
      ['/personal_finance/forecast', 'Forecast'],
      ['/personal_finance/transactions', 'Transactions'],
    ];

    for (const [url, screen] of cases) {
      await renderAt(url);
      expect(TestBed.inject(Title).getTitle()).toBe(pageTitle(screen));
    }
  });

  it('should set the Dashboard title after the root redirect', async () => {
    await renderAt('/');
    expect(TestBed.inject(Title).getTitle()).toBe(pageTitle('Dashboard'));
  });

  it('renders the Personal Finance dashboard at /personal_finance', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Dashboard',
    );
  });

  it('renders the Accounts page at /personal_finance/accounts', async () => {
    const { compiled } = await renderAt('/personal_finance/accounts');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Accounts',
    );
  });

  it('renders the account detail page at /personal_finance/accounts/:id', async () => {
    const { compiled, router } = await renderAt('/personal_finance/accounts/1');
    expect(router.url).toBe('/personal_finance/accounts/1');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Demo Main Account',
    );
  });

  it('returns from account detail to the Accounts list', async () => {
    const { compiled, router } = await renderAt('/personal_finance/accounts/1');
    const backLink = compiled.querySelector(
      'a[href="/personal_finance/accounts"]',
    ) as HTMLAnchorElement | null;

    expect(backLink).toBeTruthy();
    await router.navigateByUrl('/personal_finance/accounts');
    expect(router.url).toBe('/personal_finance/accounts');
  });

  it('renders the Analysis page at /personal_finance/analysis', async () => {
    const { compiled } = await renderAt('/personal_finance/analysis');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Analysis');
  });

  it('renders the Forecast page at /personal_finance/forecast', async () => {
    const { compiled } = await renderAt('/personal_finance/forecast');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Forecast');
  });

  it('renders the Transactions page at /personal_finance/transactions', async () => {
    const { compiled } = await renderAt('/personal_finance/transactions');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Transactions',
    );
  });

  it('renders the Goals page at /personal_finance/goals', async () => {
    const { compiled } = await renderAt('/personal_finance/goals');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Goals');
  });

  it('renders the Schedules page at /personal_finance/schedules', async () => {
    const { compiled } = await renderAt('/personal_finance/schedules');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Schedules',
    );
  });

  it('has Personal Finance navigation links', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(navHrefs(compiled)).toEqual([
      '/personal_finance',
      '/personal_finance/transactions',
      '/personal_finance/accounts',
      '/personal_finance/schedules',
      '/personal_finance/forecast',
      '/personal_finance/analysis',
      '/personal_finance/goals',
    ]);
  });

  it('marks Dashboard as the active tab on /personal_finance', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(activeNavHref(compiled)).toBe('/personal_finance');
  });

  it('marks Accounts as the active tab on /personal_finance/accounts', async () => {
    const { compiled } = await renderAt('/personal_finance/accounts');
    expect(activeNavHref(compiled)).toBe('/personal_finance/accounts');
  });

  it('marks Accounts as the active tab on account detail', async () => {
    const { compiled } = await renderAt('/personal_finance/accounts/1');
    expect(activeNavHref(compiled)).toBe('/personal_finance/accounts');
  });

  it('marks Analysis as the active tab on /personal_finance/analysis', async () => {
    const { compiled } = await renderAt('/personal_finance/analysis');
    expect(activeNavHref(compiled)).toBe('/personal_finance/analysis');
  });

  it('marks Forecast as the active tab on /personal_finance/forecast', async () => {
    const { compiled } = await renderAt('/personal_finance/forecast');
    expect(activeNavHref(compiled)).toBe('/personal_finance/forecast');
  });

  it('marks Transactions as the active tab on /personal_finance/transactions', async () => {
    const { compiled } = await renderAt('/personal_finance/transactions');
    expect(activeNavHref(compiled)).toBe('/personal_finance/transactions');
  });

  it('marks Goals as the active tab on /personal_finance/goals', async () => {
    const { compiled } = await renderAt('/personal_finance/goals');
    expect(activeNavHref(compiled)).toBe('/personal_finance/goals');
  });

  it('marks Schedules as the active tab on /personal_finance/schedules', async () => {
    const { compiled } = await renderAt('/personal_finance/schedules');
    expect(activeNavHref(compiled)).toBe('/personal_finance/schedules');
  });
});
