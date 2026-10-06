import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AccountService } from './accounts/account.service';
import { AnalysisService } from './analysis/analysis.service';
import { App } from './app';
import { routes } from './app.routes';
import { ForecastService } from './forecast/forecast.service';
import { TransactionService } from './transactions/transactions.service';

describe('App routing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
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
          },
        },
        {
          provide: AnalysisService,
          useValue: {
            getSummary: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                total_income: '0.00',
                total_expenses: '0.00',
                net_cash_flow: '0.00',
              }),
            getExpenses: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                total_expenses: '0.00',
                categories: [],
              }),
            getCashFlow: () =>
              of({
                from_date: '2026-10-01',
                to_date: '2026-10-05',
                group_by: 'month',
                periods: [],
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
    return [...compiled.querySelectorAll('header nav a')].map((el) =>
      el.getAttribute('href'),
    );
  }

  function activeNavHref(compiled: HTMLElement): string | null {
    return compiled.querySelector('nav a.active')?.getAttribute('href') ?? null;
  }

  it('redirects / to /personal_finance', async () => {
    const { compiled, router } = await renderAt('/');
    expect(router.url).toBe('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Dashboard',
    );
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

  it('has Personal Finance navigation links', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(navHrefs(compiled)).toEqual([
      '/personal_finance',
      '/personal_finance/accounts',
      '/personal_finance/analysis',
      '/personal_finance/forecast',
      '/personal_finance/transactions',
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
});
