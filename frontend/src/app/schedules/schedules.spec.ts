import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { Income } from './income';
import { IncomeService } from './income.service';
import { RecurringExpense } from './recurring-expense';
import { RecurringExpenseService } from './recurring-expense.service';
import { Schedules } from './schedules';

describe('Schedules', () => {
  const sampleAccounts: Account[] = [
    {
      id: 1,
      name: 'Checking',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '5000.00',
      created_at: '2026-01-01T00:00:00',
    },
  ];

  const activeIncome: Income = {
    id: 10,
    account_id: 1,
    amount: '2500.00',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: '2026-02-01',
    end_date: null,
    active: true,
    created_at: '2026-01-01T00:00:00',
  };

  const inactiveIncome: Income = {
    id: 11,
    account_id: 1,
    amount: '2000.00',
    frequency: 'weekly',
    start_date: '2025-01-01',
    next_occurrence: '2025-06-01',
    end_date: '2025-12-31',
    active: false,
    created_at: '2025-01-01T00:00:00',
  };

  const activeExpense: RecurringExpense = {
    id: 20,
    account_id: 1,
    description: 'Rent',
    amount: '900.00',
    category: 'Housing',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: '2026-02-01',
    end_date: null,
    active: true,
    created_at: '2026-01-01T00:00:00',
  };

  const inactiveExpense: RecurringExpense = {
    id: 21,
    account_id: 1,
    description: 'Old gym',
    amount: '40.00',
    category: null,
    frequency: 'monthly',
    start_date: '2025-01-01',
    next_occurrence: '2025-06-01',
    end_date: '2025-12-31',
    active: false,
    created_at: '2025-01-01T00:00:00',
  };

  let listIncomes: ReturnType<typeof vi.fn>;
  let createIncome: ReturnType<typeof vi.fn>;
  let updateIncome: ReturnType<typeof vi.fn>;
  let listRecurringExpenses: ReturnType<typeof vi.fn>;
  let createRecurringExpense: ReturnType<typeof vi.fn>;
  let updateRecurringExpense: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listIncomes = vi.fn().mockReturnValue(of([activeIncome]));
    createIncome = vi.fn().mockReturnValue(of(activeIncome));
    updateIncome = vi.fn().mockReturnValue(of(activeIncome));
    listRecurringExpenses = vi.fn().mockReturnValue(of([activeExpense]));
    createRecurringExpense = vi.fn().mockReturnValue(of(activeExpense));
    updateRecurringExpense = vi.fn().mockReturnValue(of(activeExpense));
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));

    await TestBed.configureTestingModule({
      imports: [Schedules],
      providers: [
        {
          provide: IncomeService,
          useValue: { listIncomes, createIncome, updateIncome },
        },
        {
          provide: RecurringExpenseService,
          useValue: {
            listRecurringExpenses,
            createRecurringExpense,
            updateRecurringExpense,
          },
        },
        {
          provide: AccountService,
          useValue: { listAccounts },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<Schedules>>;
    compiled: HTMLElement;
    component: Schedules;
  }> {
    const fixture = TestBed.createComponent(Schedules);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      compiled: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance,
    };
  }

  function fillValidIncomeForm(component: Schedules): void {
    component.formAccountId = '1';
    component.formAmount = '2500';
    component.formFrequency = 'monthly';
    component.formStartDateDisplay = '01-01-2026';
    component.formNextOccurrenceDisplay = '01-02-2026';
    component.formEndDateDisplay = '';
    component.formActive = true;
  }

  function fillValidExpenseForm(component: Schedules): void {
    component.formAccountId = '1';
    component.formDescription = 'Rent';
    component.formAmount = '900';
    component.formCategory = 'Housing';
    component.formFrequency = 'monthly';
    component.formStartDateDisplay = '01-01-2026';
    component.formNextOccurrenceDisplay = '01-02-2026';
    component.formEndDateDisplay = '';
    component.formActive = true;
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Schedules);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load incomes and recurring expenses', async () => {
    const { compiled } = await render();
    expect(listIncomes).toHaveBeenCalledTimes(1);
    expect(listRecurringExpenses).toHaveBeenCalledTimes(1);
    expect(listAccounts).toHaveBeenCalledTimes(1);
    expect(compiled.textContent).toContain('Salary');
    expect(compiled.textContent).toContain('Rent');
    expect(compiled.textContent).toContain('inform Forecast');
  });

  it('should show loading until schedules arrive', async () => {
    const pendingIncomes = new Subject<Income[]>();
    const pendingExpenses = new Subject<RecurringExpense[]>();
    listIncomes.mockReturnValue(pendingIncomes.asObservable());
    listRecurringExpenses.mockReturnValue(pendingExpenses.asObservable());

    const fixture = TestBed.createComponent(Schedules);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading schedules...');

    pendingIncomes.next([activeIncome]);
    pendingIncomes.complete();
    pendingExpenses.next([activeExpense]);
    pendingExpenses.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading schedules...');
  });

  it('should show an API error state', async () => {
    listIncomes.mockReturnValue(throwError(() => new Error('fail')));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('Unable to load schedules.');
  });

  it('should show empty states', async () => {
    listIncomes.mockReturnValue(of([]));
    listRecurringExpenses.mockReturnValue(of([]));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('No salary schedules yet.');
    expect(compiled.textContent).toContain('No recurring expenses yet.');
  });

  it('should filter active and inactive records', async () => {
    listIncomes.mockReturnValue(of([activeIncome, inactiveIncome]));
    listRecurringExpenses.mockReturnValue(
      of([activeExpense, inactiveExpense]),
    );
    const { compiled, component } = await render();

    expect(compiled.textContent).toContain('Inactive');
    expect(component.filteredIncomes).toHaveLength(2);

    component.onIncomeFilterChange('active');
    expect(component.filteredIncomes).toEqual([activeIncome]);

    component.onIncomeFilterChange('inactive');
    expect(component.filteredIncomes).toEqual([inactiveIncome]);

    component.onExpenseFilterChange('inactive');
    expect(component.filteredExpenses).toEqual([inactiveExpense]);
  });

  it('should validate salary create form', async () => {
    const { fixture, compiled, component } = await render();
    (
      compiled.querySelector(
        '.create-schedule-button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    component.saveSchedule();
    fixture.detectChanges();

    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formAccountError).toBe('Select an account.');
    expect(component.formAmountError).toBe(
      'Enter an amount greater than zero.',
    );
  });

  it('should require a recurring-expense description', async () => {
    const { fixture, component } = await render();
    component.startCreateExpense();
    fillValidExpenseForm(component);
    component.formDescription = '   ';
    component.saveSchedule();
    fixture.detectChanges();

    expect(createRecurringExpense).not.toHaveBeenCalled();
    expect(component.formDescriptionError).toBe('Enter a description.');
  });

  it('should enforce date constraints in the form', async () => {
    const { fixture, component } = await render();
    component.startCreateIncome();
    fillValidIncomeForm(component);
    component.formStartDateDisplay = '01-03-2026';
    component.formNextOccurrenceDisplay = '01-02-2026';
    component.saveSchedule();
    fixture.detectChanges();

    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formStartDateError).toBe(
      'Start date must be on or before next occurrence.',
    );

    fillValidIncomeForm(component);
    component.formEndDateDisplay = '15-01-2026';
    component.saveSchedule();
    fixture.detectChanges();

    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formEndDateError).toContain(
      'on or before end date',
    );
  });

  it('should create a salary schedule with ISO dates', async () => {
    const { fixture, component } = await render();
    component.startCreateIncome();
    fillValidIncomeForm(component);
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(createIncome).toHaveBeenCalledWith({
      account_id: 1,
      amount: 2500,
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: null,
      active: true,
    });
  });

  it('should create a recurring expense', async () => {
    const { fixture, component } = await render();
    component.startCreateExpense();
    fillValidExpenseForm(component);
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(createRecurringExpense).toHaveBeenCalledWith({
      account_id: 1,
      description: 'Rent',
      amount: 900,
      category: 'Housing',
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: null,
      active: true,
    });
  });

  it('should edit a salary schedule with a full PUT payload', async () => {
    const { fixture, component } = await render();
    component.startEditIncome(activeIncome);
    component.formAmount = '2600';
    component.formEndDateDisplay = '31-12-2026';
    component.formActive = true;
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateIncome).toHaveBeenCalledWith(10, {
      account_id: 1,
      amount: 2600,
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: '2026-12-31',
      active: true,
    });
    const payload = updateIncome.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual([
      'account_id',
      'active',
      'amount',
      'end_date',
      'frequency',
      'next_occurrence',
      'start_date',
    ]);
  });

  it('should edit a recurring expense with a full PUT payload', async () => {
    const { fixture, component } = await render();
    component.startEditExpense(activeExpense);
    component.formDescription = 'Apartment rent';
    component.formCategory = '';
    component.formActive = true;
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateRecurringExpense).toHaveBeenCalledWith(20, {
      account_id: 1,
      description: 'Apartment rent',
      amount: 900,
      category: null,
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: null,
      active: true,
    });
    const payload = updateRecurringExpense.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual([
      'account_id',
      'active',
      'amount',
      'category',
      'description',
      'end_date',
      'frequency',
      'next_occurrence',
      'start_date',
    ]);
  });

  it('should deactivate a salary schedule with active false', async () => {
    const { fixture, component } = await render();
    component.deactivateIncome(activeIncome);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateIncome).toHaveBeenCalledWith(10, {
      account_id: 1,
      amount: 2500,
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: null,
      active: false,
    });
  });

  it('should deactivate a recurring expense with active false', async () => {
    const { fixture, component } = await render();
    component.deactivateExpense(activeExpense);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateRecurringExpense).toHaveBeenCalledWith(20, {
      account_id: 1,
      description: 'Rent',
      amount: 900,
      category: 'Housing',
      frequency: 'monthly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-01',
      end_date: null,
      active: false,
    });
  });

  it('should surface API errors from create', async () => {
    createIncome.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              detail: 'start_date must be on or before next_occurrence',
            },
          }),
      ),
    );
    const { fixture, component } = await render();
    component.startCreateIncome();
    fillValidIncomeForm(component);
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formError).toBe(
      'start_date must be on or before next_occurrence',
    );
  });

  it('should surface FastAPI field validation errors', async () => {
    createRecurringExpense.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              detail: [
                {
                  loc: ['body', 'amount'],
                  msg: 'Input should be greater than 0',
                },
              ],
            },
          }),
      ),
    );
    const { fixture, component } = await render();
    component.startCreateExpense();
    fillValidExpenseForm(component);
    component.saveSchedule();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formError).toContain('Amount');
    expect(component.formError).toContain('greater than 0');
  });

  it('should block create when accounts are missing', async () => {
    listAccounts.mockReturnValue(of([]));
    const { fixture, compiled, component } = await render();

    expect(compiled.textContent).toContain(
      'Create an account before adding',
    );
    component.startCreateIncome();
    fixture.detectChanges();

    expect(component.formMode).toBeNull();
    expect(component.formError).toContain('Create an account');
  });

  it('should keep create unavailable when accounts fail to load', async () => {
    listAccounts.mockReturnValue(throwError(() => new Error('fail')));
    const { fixture, compiled, component } = await render();

    expect(compiled.textContent).toContain('Unable to load accounts');
    component.startCreateIncome();
    fixture.detectChanges();

    expect(component.formMode).toBeNull();
  });

  it('should not inject or call transaction APIs', async () => {
    const { component } = await render();
    expect(
      (component as unknown as { transactionService?: unknown })
        .transactionService,
    ).toBeUndefined();
    expect(listAccounts).toHaveBeenCalled();
    expect(listAccounts.mock.calls[0]).toEqual([]);
  });
});
