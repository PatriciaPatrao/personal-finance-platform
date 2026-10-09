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
      current_balance: '5000.00',
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

  const unallocatedGoal: FinancialGoal = {
    id: 10,
    name: 'Idea',
    target_amount: '1000.00',
    currency: 'EUR',
    target_date: null,
    created_at: '2026-01-10T00:00:00',
    allocations: [],
    current_amount: null,
    progress: null,
    completed: null,
  };

  const allocatedGoal: FinancialGoal = {
    id: 11,
    name: 'Vacation',
    target_amount: '10000.00',
    currency: 'EUR',
    target_date: '2027-06-01',
    created_at: '2026-01-11T00:00:00',
    allocations: [
      {
        id: 21,
        goal_id: 11,
        account_id: 1,
        amount: '5000.00',
        funded_amount: '5000.00',
        created_at: '2026-01-11T01:00:00',
      },
    ],
    current_amount: '5000.00',
    progress: '0.5',
    completed: false,
  };

  const completedGoal: FinancialGoal = {
    id: 12,
    name: 'Emergency Fund',
    target_amount: '10000.00',
    currency: 'EUR',
    target_date: null,
    created_at: '2026-01-12T00:00:00',
    allocations: [
      {
        id: 22,
        goal_id: 12,
        account_id: 1,
        amount: '10000.00',
        funded_amount: '10000.00',
        created_at: '2026-01-12T01:00:00',
      },
    ],
    current_amount: '10000.00',
    progress: '1',
    completed: true,
  };

  let listGoals: ReturnType<typeof vi.fn>;
  let createGoal: ReturnType<typeof vi.fn>;
  let updateGoal: ReturnType<typeof vi.fn>;
  let createAllocation: ReturnType<typeof vi.fn>;
  let updateAllocation: ReturnType<typeof vi.fn>;
  let deleteAllocation: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listGoals = vi.fn().mockReturnValue(of([allocatedGoal]));
    createGoal = vi.fn().mockReturnValue(of(unallocatedGoal));
    updateGoal = vi.fn().mockReturnValue(of(allocatedGoal));
    createAllocation = vi.fn().mockReturnValue(of(allocatedGoal));
    updateAllocation = vi.fn().mockReturnValue(of(allocatedGoal));
    deleteAllocation = vi.fn().mockReturnValue(of(unallocatedGoal));
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));

    await TestBed.configureTestingModule({
      imports: [Goals],
      providers: [
        {
          provide: GoalService,
          useValue: {
            listGoals,
            createGoal,
            updateGoal,
            createAllocation,
            updateAllocation,
            deleteAllocation,
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

    pending.next([allocatedGoal]);
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

  it('should show unavailable progress for an unallocated goal', async () => {
    listGoals.mockReturnValue(of([unallocatedGoal]));
    const { compiled } = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain('Progress unavailable');
    expect(text).toContain('No money allocated yet');
    expect(text).not.toMatch(/Progress unavailable[\s\S]*0%/);
    expect(compiled.querySelector('progress')).toBeNull();
  });

  it('should show funded amount and progress', async () => {
    const { compiled } = await render();
    const text = compiled.textContent ?? '';
    expect(text).toContain('Funded');
    expect(text).not.toContain('Allocated');
    expect(text).toContain('Savings');
    expect(text).toContain('50%');
    expect(
      (compiled.querySelector('progress') as HTMLProgressElement).value,
    ).toBe(50);
  });

  it('should display allocations on the goal card', async () => {
    const { compiled } = await render();
    expect(compiled.textContent).toContain('Allocations');
    expect(compiled.textContent).toContain('Savings');
    expect(compiled.textContent).toContain('Designated');
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

  it('should create an unallocated goal', async () => {
    listGoals
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([unallocatedGoal]));
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
    });
    expect(compiled.textContent).toContain('Goal created.');
    expect(compiled.textContent).toContain('Idea');
  });

  it('should preserve form state when create fails', async () => {
    listGoals.mockReturnValue(of([]));
    createGoal.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { detail: 'Unable to save the goal.' },
          }),
      ),
    );
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Vacation';
    component.formTargetAmount = '5000.00';
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.formMode).toBe('create');
    expect(component.formName).toBe('Vacation');
    expect(compiled.textContent).toContain('Unable to save the goal.');
  });

  it('should edit a goal inline without an account field', async () => {
    const updated: FinancialGoal = {
      ...allocatedGoal,
      name: 'Holiday',
    };
    updateGoal.mockReturnValue(of(updated));
    listGoals
      .mockReturnValueOnce(of([allocatedGoal]))
      .mockReturnValueOnce(of([updated]));

    const { fixture, compiled, component } = await render();
    (compiled.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.formMode).toBe('edit');
    expect(component.formName).toBe('Vacation');
    expect(compiled.querySelector('select[name="accountId"]')).toBeNull();
    expect(component.currencyLocked).toBe(true);

    component.formName = 'Holiday';
    component.saveGoal();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateGoal).toHaveBeenCalledWith(11, {
      name: 'Holiday',
      target_amount: 10000,
      currency: 'EUR',
      target_date: '2027-06-01',
    });
    expect(compiled.textContent).toContain('Goal updated.');
  });

  function clickAddMoney(compiled: HTMLElement): void {
    const button = [...compiled.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Add money',
    ) as HTMLButtonElement;
    button.click();
  }

  it('should open add money and show available amount', async () => {
    const { fixture, compiled, component } = await render();
    clickAddMoney(compiled);
    fixture.detectChanges();

    expect(component.allocatingGoalId).toBe(11);
    expect(compiled.textContent).toContain('Add money');
    expect(compiled.textContent).toContain('available');
    expect(component.availableOnAccount(1)).toBe(0);
    expect(component.designatedOnAccount(1)).toBe(5000);
  });

  it('should prevent allocating more than available', async () => {
    listGoals.mockReturnValue(of([unallocatedGoal]));
    const { fixture, compiled, component } = await render();
    clickAddMoney(compiled);
    fixture.detectChanges();

    component.allocateAccountId = '1';
    component.allocateAmount = '6000.00';
    component.saveAllocation();
    fixture.detectChanges();

    expect(createAllocation).not.toHaveBeenCalled();
    expect(component.allocateAmountError).toContain('Only 5000.00 is available');
  });

  it('should create an allocation and refresh the goal', async () => {
    const after: FinancialGoal = {
      ...unallocatedGoal,
      allocations: [
        {
          id: 30,
          goal_id: 10,
          account_id: 1,
          amount: '1000.00',
          funded_amount: '1000.00',
          created_at: '2026-01-13T00:00:00',
        },
      ],
      current_amount: '1000.00',
      progress: '1',
      completed: true,
    };
    listGoals
      .mockReturnValueOnce(of([unallocatedGoal]))
      .mockReturnValueOnce(of([after]));
    createAllocation.mockReturnValue(of(after));

    const { fixture, compiled, component } = await render();
    clickAddMoney(compiled);
    fixture.detectChanges();

    component.allocateAccountId = '1';
    component.allocateAmount = '1000.00';
    component.saveAllocation();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createAllocation).toHaveBeenCalledWith(10, {
      account_id: 1,
      amount: 1000,
    });
    expect(compiled.textContent).toContain('Allocation updated.');
    expect(compiled.textContent).toContain('100%');
  });

  it('should show backend allocation errors', async () => {
    listGoals.mockReturnValue(of([unallocatedGoal]));
    createAllocation.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              detail: 'Allocation exceeds available account balance',
            },
          }),
      ),
    );
    const { fixture, compiled, component } = await render();
    clickAddMoney(compiled);
    fixture.detectChanges();

    component.allocateAccountId = '1';
    component.allocateAmount = '100.00';
    component.saveAllocation();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.textContent).toContain(
      'Allocation exceeds available account balance',
    );
    expect(component.allocatingGoalId).toBe(10);
  });

  it('should display multiple allocations', async () => {
    listAccounts.mockReturnValue(
      of([
        sampleAccounts[0],
        {
          id: 3,
          name: 'Cash',
          account_type: 'cash',
          currency: 'EUR',
          current_balance: '2000.00',
          created_at: '2026-01-03T00:00:00',
        },
      ]),
    );
    const multiAccounts: FinancialGoal = {
      ...allocatedGoal,
      allocations: [
        allocatedGoal.allocations[0],
        {
          id: 31,
          goal_id: 11,
          account_id: 3,
          amount: '500.00',
          funded_amount: '500.00',
          created_at: '2026-01-14T00:00:00',
        },
      ],
      current_amount: '5500.00',
      progress: '0.55',
      completed: false,
    };
    listGoals.mockReturnValue(of([multiAccounts]));
    const { compiled } = await render();
    expect(compiled.textContent).toContain('Savings');
    expect(compiled.textContent).toContain('Cash');
  });

  it('should keep only one goal in the inline editor', async () => {
    listGoals.mockReturnValue(of([allocatedGoal, unallocatedGoal]));
    const { fixture, compiled, component } = await render();

    const editButtons = () =>
      [...compiled.querySelectorAll('.edit-button')] as HTMLButtonElement[];

    editButtons()[0].click();
    fixture.detectChanges();
    expect(component.editingId).toBe(11);

    editButtons()[0].click();
    fixture.detectChanges();
    expect(component.editingId).toBe(10);
    expect(compiled.querySelectorAll('.goal-editing')).toHaveLength(1);
  });
});
