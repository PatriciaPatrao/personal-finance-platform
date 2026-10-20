import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { AnalysisService } from '../analysis/analysis.service';
import { ForecastService } from '../forecast/forecast.service';
import { GoalService } from '../goals/goal.service';
import { Income } from '../schedules/income';
import { IncomeService } from '../schedules/income.service';
import { RecurringExpenseService } from '../schedules/recurring-expense.service';
import { DomainDateService } from '../shared/domain-date.service';
import { TransactionService } from '../transactions/transactions.service';
import { PersonalFinance } from './personal-finance';

describe('PersonalFinance domain date', () => {
  const sampleAccounts: Account[] = [
    {
      id: 1,
      name: 'Main',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '5000.00',
      created_at: '2026-01-01T00:00:00',
    },
  ];

  const incomeDueOnServer: Income = {
    id: 10,
    account_id: 1,
    amount: '100.00',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: '2026-03-01',
    end_date: null,
    active: true,
    created_at: '2026-01-01T00:00:00',
  };

  it('should use API domain date for the schedules primary action, not the browser clock', async () => {
    const loadCurrentDomainDate = vi
      .fn()
      .mockReturnValue(of('2026-03-01'));

    await TestBed.configureTestingModule({
      imports: [PersonalFinance],
      providers: [
        provideRouter([{ path: 'personal_finance', component: PersonalFinance }]),
        {
          provide: AccountService,
          useValue: { listAccounts: vi.fn().mockReturnValue(of(sampleAccounts)) },
        },
        {
          provide: AnalysisService,
          useValue: {
            getSummary: vi.fn().mockReturnValue(
              of({
                from_date: '2026-03-01',
                to_date: '2026-03-01',
                by_currency: [],
              }),
            ),
          },
        },
        {
          provide: ForecastService,
          useValue: {
            getForecast: vi.fn().mockReturnValue(
              of({
                from_date: '2026-03-01',
                to_date: '2026-06-30',
                scope: 'household',
                account_id: null,
                group_by: 'month',
                projections: [],
              }),
            ),
          },
        },
        { provide: GoalService, useValue: { listGoals: vi.fn().mockReturnValue(of([])) } },
        {
          provide: TransactionService,
          useValue: {
            listTransactions: vi.fn().mockReturnValue(of([{ id: 1 }])),
          },
        },
        {
          provide: IncomeService,
          useValue: {
            listIncomes: vi.fn().mockReturnValue(of([incomeDueOnServer])),
          },
        },
        {
          provide: RecurringExpenseService,
          useValue: { listRecurringExpenses: vi.fn().mockReturnValue(of([])) },
        },
        {
          provide: DomainDateService,
          useValue: { loadCurrentDomainDate, resetForTests: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Review schedules');
    expect(text).toContain('occurrence due today');
  });

  it('should not promise a schedule due today when domain date is unavailable', async () => {
    const loadCurrentDomainDate = vi.fn().mockReturnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [PersonalFinance],
      providers: [
        provideRouter([{ path: 'personal_finance', component: PersonalFinance }]),
        {
          provide: AccountService,
          useValue: { listAccounts: vi.fn().mockReturnValue(of(sampleAccounts)) },
        },
        {
          provide: AnalysisService,
          useValue: {
            getSummary: vi.fn().mockReturnValue(
              of({
                from_date: '2026-03-01',
                to_date: '2026-03-01',
                by_currency: [],
              }),
            ),
          },
        },
        {
          provide: ForecastService,
          useValue: {
            getForecast: vi.fn().mockReturnValue(
              of({
                from_date: '2026-03-01',
                to_date: '2026-06-30',
                scope: 'household',
                account_id: null,
                group_by: 'month',
                projections: [],
              }),
            ),
          },
        },
        { provide: GoalService, useValue: { listGoals: vi.fn().mockReturnValue(of([])) } },
        {
          provide: TransactionService,
          useValue: {
            listTransactions: vi.fn().mockReturnValue(of([{ id: 1 }])),
          },
        },
        {
          provide: IncomeService,
          useValue: {
            listIncomes: vi.fn().mockReturnValue(of([incomeDueOnServer])),
          },
        },
        {
          provide: RecurringExpenseService,
          useValue: { listRecurringExpenses: vi.fn().mockReturnValue(of([])) },
        },
        {
          provide: DomainDateService,
          useValue: { loadCurrentDomainDate, resetForTests: vi.fn() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PersonalFinance);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('occurrence due today');
  });
});
