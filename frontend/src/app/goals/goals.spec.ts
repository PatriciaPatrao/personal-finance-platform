import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { FinancialGoal } from './goal';
import { GoalService } from './goal.service';
import { Goals } from './goals';

describe('Goals', () => {
  const sampleAccounts: Account[] = [
    {
      id: 1,
      name: 'Savings',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '2500.00',
      created_at: '2026-01-01T00:00:00',
    },
    {
      id: 2,
      name: 'Travel USD',
      account_type: 'bank',
      currency: 'USD',
      current_balance: '100.00',
      created_at: '2026-01-02T00:00:00',
    },
  ];

  const unlinkedGoal: FinancialGoal = {
    id: 10,
    name: 'Idea',
    target_amount: '1000.00',
    currency: 'EUR',
    target_date: null,
    account_id: null,
    created_at: '2026-01-10T00:00:00',
    current_amount: null,
    progress: null,
    completed: null,
  };

  const linkedGoal: FinancialGoal = {
    id: 11,
    name: 'Vacation',
    target_amount: '5000.00',
    currency: 'EUR',
    target_date: '2027-06-01',
    account_id: 1,
    created_at: '2026-01-11T00:00:00',
    current_amount: '2500.00',
    progress: '0.5',
    completed: false,
  };

  const completedGoal: FinancialGoal = {
    id: 12,
    name: 'Emergency Fund',
    target_amount: '10000.00',
    currency: 'EUR',
    target_date: null,
    account_id: 1,
    created_at: '2026-01-12T00:00:00',
    current_amount: '15000.00',
    progress: '1',
    completed: true,
  };

  let listGoals: ReturnType<typeof vi.fn>;
  let createGoal: ReturnType<typeof vi.fn>;
  let updateGoal: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listGoals = vi.fn().mockReturnValue(of([linkedGoal]));
    createGoal = vi.fn().mockReturnValue(of(unlinkedGoal));
    updateGoal = vi.fn().mockReturnValue(of(linkedGoal));
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));

    await TestBed.configureTestingModule({
      imports: [Goals],
      providers: [
        {
          provide: GoalService,
          useValue: { listGoals, createGoal, updateGoal },
        },
        {
          provide: AccountService,
          useValue: { listAccounts },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<Goals>>;
    compiled: HTMLElement;
    component: Goals;
  }> {
    const fixture = TestBed.createComponent(Goals);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      compiled: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance,
    };
  }

  function openCreateForm(
    fixture: ReturnType<typeof TestBed.createComponent<Goals>>,
    compiled: HTMLElement,
  ): void {
    (
      compiled.querySelector('.create-goal-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Goals);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load goals', async () => {
    const { compiled } = await render();
    expect(listGoals).toHaveBeenCalledTimes(1);
    expect(compiled.textContent).toContain('Vacation');
  });

  it('should show loading until goals arrive', async () => {
    const pending = new Subject<FinancialGoal[]>();
    listGoals.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Goals);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading goals...');

    pending.next([linkedGoal]);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading goals...');
  });

  it('should show an API error state', async () => {
    listGoals.mockReturnValue(throwError(() => new Error('fail')));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('Unable to load goals.');
  });

  it('should show an empty state', async () => {
    listGoals.mockReturnValue(of([]));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('No financial goals yet.');
    expect(compiled.querySelector('.create-goal-button')).toBeTruthy();
  });

  it('should show unavailable progress for an unlinked goal', async () => {
    listGoals.mockReturnValue(of([unlinkedGoal]));
    const { compiled } = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain('Progress unavailable');
    expect(text).toContain('No account associated');
    expect(text).not.toMatch(/Progress unavailable[\s\S]*0%/);
    expect(compiled.querySelector('progress')).toBeNull();
  });

  it('should show current amount and progress for a linked goal', async () => {
    const { compiled } = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain('Savings');
    expect(text).toContain('50%');
    expect(
      (compiled.querySelector('progress') as HTMLProgressElement).value,
    ).toBe(50);
  });

  it('should display 100% progress correctly', async () => {
    listGoals.mockReturnValue(of([completedGoal]));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('100%');
    expect(
      (compiled.querySelector('progress') as HTMLProgressElement).value,
    ).toBe(100);
  });

  it('should display completed state', async () => {
    listGoals.mockReturnValue(of([completedGoal]));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('Completed');
    expect(compiled.querySelector('.goal-completed')).toBeTruthy();
  });

  it('should validate the create form', async () => {
    listGoals.mockReturnValue(of([]));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.saveGoal();
    fixture.detectChanges();

    expect(createGoal).not.toHaveBeenCalled();
    expect(component.formNameError).toBe('Enter a goal name.');
    expect(component.formTargetAmountError).toBe(
      'Enter a target amount greater than zero.',
    );
  });

  it('should create an unlinked goal', async () => {
    listGoals
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([unlinkedGoal]));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Idea';
    component.formTargetAmount = '1000.00';
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createGoal).toHaveBeenCalledWith({
      name: 'Idea',
      target_amount: 1000,
      currency: 'EUR',
      target_date: null,
      account_id: null,
    });
    expect(compiled.textContent).toContain('Goal created.');
    expect(compiled.textContent).toContain('Idea');
  });

  it('should create a linked goal', async () => {
    listGoals
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([linkedGoal]));
    createGoal.mockReturnValue(of(linkedGoal));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Vacation';
    component.formTargetAmount = '5000.00';
    component.onFormAccountChange('1');
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createGoal).toHaveBeenCalledWith({
      name: 'Vacation',
      target_amount: 5000,
      currency: 'EUR',
      target_date: null,
      account_id: 1,
    });
  });

  it('should preserve form state when create fails', async () => {
    listGoals.mockReturnValue(of([]));
    createGoal.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'Account already has a financial goal' },
          }),
      ),
    );
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Vacation';
    component.formTargetAmount = '5000.00';
    component.onFormAccountChange('1');
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formMode).toBe('create');
    expect(component.formName).toBe('Vacation');
    expect(component.formTargetAmount).toBe('5000.00');
    expect(component.formAccountId).toBe('1');
    expect(compiled.textContent).toContain(
      'Account already has a financial goal',
    );
  });

  it('should edit a goal', async () => {
    const updated: FinancialGoal = {
      ...linkedGoal,
      name: 'Holiday',
    };
    updateGoal.mockReturnValue(of(updated));
    listGoals
      .mockReturnValueOnce(of([linkedGoal]))
      .mockReturnValueOnce(of([updated]));

    const { fixture, compiled, component } = await render();
    (compiled.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.formMode).toBe('edit');
    expect(component.formName).toBe('Vacation');
    expect(
      (
        compiled.querySelector(
          'select[name="accountId"]',
        ) as HTMLSelectElement
      ).value,
    ).toBe('1');
    component.formName = 'Holiday';
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateGoal).toHaveBeenCalledWith(11, {
      name: 'Holiday',
      target_amount: 5000,
      currency: 'EUR',
      target_date: '2027-06-01',
      account_id: 1,
    });
    expect(compiled.textContent).toContain('Goal updated.');
    expect(compiled.textContent).toContain('Holiday');
  });

  it('should refresh progress after changing the target', async () => {
    const afterUpdate: FinancialGoal = {
      ...completedGoal,
      target_amount: '20000.00',
      progress: '0.75',
      completed: false,
    };
    listGoals
      .mockReturnValueOnce(of([completedGoal]))
      .mockReturnValueOnce(of([afterUpdate]));
    updateGoal.mockReturnValue(of(afterUpdate));

    const { fixture, compiled, component } = await render();
    expect(compiled.textContent).toContain('Completed');
    expect(compiled.textContent).toContain('100%');

    (compiled.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    component.formTargetAmount = '20000.00';
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('75%');
    expect(compiled.textContent).not.toContain('Completed');
  });

  it('should load accounts for selection', async () => {
    listGoals.mockReturnValue(of([]));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    expect(listAccounts).toHaveBeenCalled();
    expect(component.selectableAccounts.map((item) => item.name)).toEqual([
      'Savings',
      'Travel USD',
    ]);
    const options = [
      ...compiled.querySelectorAll('select[name="accountId"] option'),
    ].map((option) => option.textContent?.trim());
    expect(options).toContain('No account');
    expect(options.some((text) => text?.includes('Savings'))).toBe(true);
  });

  it('should lock currency to the selected account', async () => {
    listGoals.mockReturnValue(of([]));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    const accountSelect = compiled.querySelector(
      'select[name="accountId"]',
    ) as HTMLSelectElement;
    accountSelect.value = '2';
    accountSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.formCurrency).toBe('USD');
    expect(component.currencyLocked).toBe(true);
    expect(
      (
        compiled.querySelector(
          'select[name="currency"]',
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    expect(compiled.textContent).toContain('Matches account currency (USD).');

    component.onFormCurrencyChange('EUR');
    expect(component.formCurrency).toBe('USD');
  });

  it('should keep the goal currency when the account is cleared', async () => {
    listGoals.mockReturnValue(of([]));
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    const currencySelect = compiled.querySelector(
      'select[name="currency"]',
    ) as HTMLSelectElement;
    currencySelect.value = 'USD';
    currencySelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const accountSelect = compiled.querySelector(
      'select[name="accountId"]',
    ) as HTMLSelectElement;
    accountSelect.value = '';
    accountSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.formAccountId).toBe('');
    expect(component.formCurrency).toBe('USD');
    expect(component.currencyLocked).toBe(false);
  });
});
