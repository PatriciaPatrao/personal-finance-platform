import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { Income } from './income';
import { IncomeService } from './income.service';
import { RecurringExpense } from './recurring-expense';
import { RecurringExpenseService } from './recurring-expense.service';
import { calendarDateToIso } from '../shared/calendar-date';
import { DomainDateService } from '../shared/domain-date.service';
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
  let executeIncome: ReturnType<typeof vi.fn>;
  let executeRecurringExpense: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;
  let loadCurrentDomainDate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listIncomes = vi.fn().mockReturnValue(of([activeIncome]));
    createIncome = vi.fn().mockReturnValue(of(activeIncome));
    updateIncome = vi.fn().mockReturnValue(of(activeIncome));
    listRecurringExpenses = vi.fn().mockReturnValue(of([activeExpense]));
    createRecurringExpense = vi.fn().mockReturnValue(of(activeExpense));
    updateRecurringExpense = vi.fn().mockReturnValue(of(activeExpense));
    executeIncome = vi.fn();
    executeRecurringExpense = vi.fn();
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));
    loadCurrentDomainDate = vi.fn(() => of(calendarDateToIso(new Date())));

    await TestBed.configureTestingModule({
      imports: [Schedules],
      providers: [
        {
          provide: IncomeService,
          useValue: {
            listIncomes,
            createIncome,
            updateIncome,
            executeIncome,
          },
        },
        {
          provide: RecurringExpenseService,
          useValue: {
            listRecurringExpenses,
            createRecurringExpense,
            updateRecurringExpense,
            executeRecurringExpense,
          },
        },
        {
          provide: AccountService,
          useValue: { listAccounts },
        },
        {
          provide: DomainDateService,
          useValue: {
            loadCurrentDomainDate,
            resetForTests: vi.fn(),
            localCalendarDateIso: () => calendarDateToIso(new Date()),
          },
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
    expect(compiled.textContent).toContain('does not add a transaction');
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
      'Enter a positive amount with at most two decimal places.',
    );

    const accountControl = compiled.querySelector(
      '#schedule-income-account[role="combobox"]',
    ) as HTMLElement;
    expect(accountControl.getAttribute('aria-invalid')).toBe('true');
    expect(accountControl.getAttribute('aria-describedby')).toBe(
      'schedule-income-account-error',
    );
    expect(accountControl.getAttribute('aria-required')).toBe('true');
  });

  it('should reject zero, negative, and over-precision schedule amounts', async () => {
    const { fixture, component } = await render();
    component.startCreateIncome();
    fillValidIncomeForm(component);

    component.formAmount = '0';
    component.saveSchedule();
    fixture.detectChanges();
    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formAmountError).toBe(
      'Enter a positive amount with at most two decimal places.',
    );

    component.formAmount = '-10';
    component.saveSchedule();
    fixture.detectChanges();
    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formAmountError).toBe(
      'Enter a positive amount with at most two decimal places.',
    );

    component.formAmount = '10.999';
    component.saveSchedule();
    fixture.detectChanges();
    expect(createIncome).not.toHaveBeenCalled();
    expect(component.formAmountError).toBe(
      'Enter a positive amount with at most two decimal places.',
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

  it('should activate a salary schedule with active true', async () => {
    const { fixture, component } = await render();
    component.activateIncome(inactiveIncome);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateIncome).toHaveBeenCalledWith(11, {
      account_id: 1,
      amount: 2000,
      frequency: 'weekly',
      start_date: '2025-01-01',
      next_occurrence: '2025-06-01',
      end_date: '2025-12-31',
      active: true,
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

  it('should activate a recurring expense with active true', async () => {
    const { fixture, component } = await render();
    component.activateExpense(inactiveExpense);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateRecurringExpense).toHaveBeenCalledWith(21, {
      account_id: 1,
      description: 'Old gym',
      amount: 40,
      category: null,
      frequency: 'monthly',
      start_date: '2025-01-01',
      next_occurrence: '2025-06-01',
      end_date: '2025-12-31',
      active: true,
    });
  });

  it('should show a page-level error when salary deactivation fails', async () => {
    updateIncome.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { detail: 'Income not found' },
          }),
      ),
    );
    const { fixture, compiled, component } = await render();
    expect(component.formMode).toBeNull();

    component.deactivateIncome(activeIncome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formMode).toBeNull();
    expect(component.formError).toBeNull();
    expect(compiled.textContent).toContain('Income not found');
    expect(compiled.querySelector('.schedule-form')).toBeNull();
  });

  it('should show a page-level error when recurring-expense deactivation fails', async () => {
    updateRecurringExpense.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { detail: 'Recurring expense not found' },
          }),
      ),
    );
    const { fixture, compiled, component } = await render();
    expect(component.formMode).toBeNull();

    component.deactivateExpense(activeExpense);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formMode).toBeNull();
    expect(component.formError).toBeNull();
    expect(compiled.textContent).toContain('Recurring expense not found');
    expect(compiled.querySelector('.schedule-form')).toBeNull();
  });

  it('should format a known account currency', async () => {
    const { compiled, component } = await render();
    expect(component.accountCurrency(1)).toBe('EUR');
    expect(compiled.textContent).toContain('€');
    expect(compiled.textContent).not.toContain('Currency unavailable');
  });

  it('should not invent EUR when accounts fail to load', async () => {
    listAccounts.mockReturnValue(throwError(() => new Error('fail')));
    const { compiled, component } = await render();

    expect(component.accountCurrency(1)).toBeNull();
    expect(compiled.textContent).toContain('Currency unavailable');
    expect(compiled.textContent).toContain('2500.00');
    expect(compiled.textContent).not.toContain('€');
  });

  it('should not invent EUR when the schedule account is unavailable', async () => {
    listIncomes.mockReturnValue(
      of([{ ...activeIncome, account_id: 99 }]),
    );
    const { compiled, component } = await render();

    expect(component.accountCurrency(99)).toBeNull();
    expect(component.accountCurrency(1)).toBe('EUR');
    const salary = compiled.querySelector('.schedule-section');
    expect(salary?.textContent).toContain('Currency unavailable');
    expect(salary?.textContent).toContain('2500.00');
    expect(salary?.textContent).not.toContain('€');
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

  it('should execute an eligible salary occurrence and show success', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));
    executeIncome.mockReturnValue(
      of({
        created: true,
        execution: {
          id: 1,
          source_type: 'income',
          source_id: 10,
          occurrence_date: '2026-02-15',
          transaction_id: 99,
          created_at: '2026-02-15T00:00:00',
          transaction_account_id: 1,
          transaction_amount: '2500.00',
          transaction_type: 'income',
          transaction_occurred_on: '2026-02-15',
        },
      }),
    );

    const { fixture, compiled, component } = await render();
    fixture.detectChanges();

    const executeButton = compiled.querySelector(
      '.execute-button',
    ) as HTMLButtonElement;
    expect(executeButton.disabled).toBe(false);
    executeButton.click();
    fixture.detectChanges();
    expect(executeIncome).not.toHaveBeenCalled();

    const confirmButton = compiled.querySelector(
      '.execution-confirm .execute-button',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(executeIncome).toHaveBeenCalledTimes(1);
    expect(executeIncome).toHaveBeenCalledWith(10, '2026-02-15');
    expect(compiled.textContent).toContain(
      'Occurrence executed. A transaction was created',
    );
    expect(component.executingKey).toBeNull();
    vi.useRealTimers();
  });

  it('should dismiss execution confirmation on Escape and restore focus', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));

    const { fixture, compiled } = await render();
    fixture.detectChanges();

    const executeButton = compiled.querySelector(
      '.execute-button',
    ) as HTMLButtonElement;
    executeButton.focus();
    executeButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = compiled.querySelector('.execution-confirm') as HTMLElement;
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(executeIncome).not.toHaveBeenCalled();
    expect(compiled.querySelector('.execution-confirm')).toBeNull();
    expect(document.activeElement).toBe(executeButton);
    vi.useRealTimers();
  });

  it('should ignore Escape when execution confirmation is closed', async () => {
    const { fixture, compiled } = await render();
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(compiled.querySelector('.execution-confirm')).toBeNull();
    expect(executeIncome).not.toHaveBeenCalled();
  });

  it('should not execute when confirmation is cancelled', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));

    const { fixture, compiled } = await render();
    fixture.detectChanges();

    const executeButton = compiled.querySelector(
      '.execute-button',
    ) as HTMLButtonElement;
    executeButton.click();
    fixture.detectChanges();

    const cancelButton = compiled.querySelector(
      '.execution-confirm .cancel-button',
    ) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(executeIncome).not.toHaveBeenCalled();
    expect(compiled.textContent).not.toContain('Confirm schedule execution?');
    vi.useRealTimers();
  });

  it('should explain idempotent execution replay without implying a new transaction', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));
    executeIncome.mockReturnValue(
      of({
        created: false,
        execution: {
          id: 1,
          source_type: 'income',
          source_id: 10,
          occurrence_date: '2026-02-15',
          transaction_id: 99,
          created_at: '2026-02-15T00:00:00',
          transaction_account_id: 1,
          transaction_amount: '2500.00',
          transaction_type: 'income',
          transaction_occurred_on: '2026-02-15',
        },
      }),
    );

    const { fixture, compiled, component } = await render();
    component.executeIncomeSchedule(eligibleIncome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('already executed');
    expect(compiled.textContent).toContain('No new transaction');
    vi.useRealTimers();
  });

  it('should surface execution rejection from the API', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));
    executeIncome.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'Occurrence date is not eligible for execution' },
          }),
      ),
    );

    const { fixture, compiled, component } = await render();
    component.executeIncomeSchedule(eligibleIncome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain(
      'Occurrence date is not eligible for execution',
    );
    expect(component.executingKey).toBeNull();
    vi.useRealTimers();
  });

  it('should block duplicate execution submissions while a request is pending', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));
    const pending = new Subject<{
      created: boolean;
      execution: { id: number };
    }>();
    executeIncome.mockReturnValue(pending.asObservable());

    const { fixture, component } = await render();
    fixture.detectChanges();

    component.executeIncomeSchedule(eligibleIncome);
    expect(component.executingKey).toBe('income:10');
    expect(executeIncome).toHaveBeenCalledTimes(1);
    expect(component.canExecuteSchedule('income', 10)).toBe(false);

    component.executeIncomeSchedule(eligibleIncome);
    expect(executeIncome).toHaveBeenCalledTimes(1);

    pending.next({
      created: true,
      execution: { id: 1 },
    });
    pending.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    vi.useRealTimers();
  });

  it('should reject client-side execution when the date is not today', async () => {
    vi.setSystemTime(new Date(2026, 1, 15));
    const eligibleIncome = {
      ...activeIncome,
      next_occurrence: '2026-02-15',
    };
    listIncomes.mockReturnValue(of([eligibleIncome]));

    const { fixture, compiled, component } = await render();
    component.onExecutionDateChange('income', 10, '16-02-2026');
    component.executeIncomeSchedule(eligibleIncome);
    fixture.detectChanges();

    expect(executeIncome).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain("Only today's date");
    vi.useRealTimers();
  });
});
