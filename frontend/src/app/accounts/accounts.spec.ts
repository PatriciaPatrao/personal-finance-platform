import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Account } from './account';
import { AccountService } from './account.service';
import { Accounts } from './accounts';

describe('Accounts', () => {
  const sampleAccounts: Account[] = [
    {
      id: 2,
      name: 'Cash Wallet',
      account_type: 'cash',
      currency: 'EUR',
      current_balance: '80.00',
      created_at: '2026-01-02T00:00:00',
    },
    {
      id: 1,
      name: 'Demo Main Account',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '5000.00',
      created_at: '2026-01-01T00:00:00',
    },
  ];

  const createdAccount: Account = {
    id: 5,
    name: 'Travel Card',
    account_type: 'credit_card',
    currency: 'EUR',
    current_balance: '-150.00',
    created_at: '2026-01-05T00:00:00',
  };

  let listAccounts: ReturnType<typeof vi.fn>;
  let createAccount: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));
    createAccount = vi.fn().mockReturnValue(of(createdAccount));

    await TestBed.configureTestingModule({
      imports: [Accounts],
      providers: [
        provideRouter([]),
        {
          provide: AccountService,
          useValue: { listAccounts, createAccount },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<Accounts>>;
    compiled: HTMLElement;
    component: Accounts;
  }> {
    const fixture = TestBed.createComponent(Accounts);
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
    fixture: ReturnType<typeof TestBed.createComponent<Accounts>>,
    compiled: HTMLElement,
  ): void {
    (
      compiled.querySelector('.create-account-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Accounts);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Accounts heading', async () => {
    const { compiled } = await render();
    expect(compiled.querySelector('h1')?.textContent).toContain('Accounts');
  });

  it('should request accounts on init', async () => {
    await render();
    expect(listAccounts).toHaveBeenCalledTimes(1);
  });

  it('should show loading until the accounts arrive', async () => {
    const pending = new Subject<Account[]>();
    listAccounts.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Accounts);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading accounts...');

    pending.next(sampleAccounts);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading accounts...');
  });

  it('should display loaded accounts with type labels and balances', async () => {
    const { compiled } = await render();
    const text = compiled.textContent ?? '';

    expect(compiled.querySelector('.data-table')).toBeTruthy();
    expect(text).toContain('Cash Wallet');
    expect(text).toContain('Demo Main Account');
    expect(text).toContain('Cash');
    expect(text).toContain('Bank');
    expect(text).toContain('EUR');
    expect(text).toContain('80.00');
    expect(text).toContain('5,000.00');

    const rows = compiled.querySelectorAll('.data-table tbody tr');
    expect(rows[0]?.textContent).toContain('Cash Wallet');
    expect(rows[1]?.textContent).toContain('Demo Main Account');
  });

  it('should link each account name to its detail route', async () => {
    const { compiled } = await render();
    const firstLink = compiled.querySelector(
      '.data-table tbody tr:first-child .account-link',
    ) as HTMLAnchorElement | null;

    expect(firstLink?.textContent?.trim()).toBe('Cash Wallet');
    expect(firstLink?.getAttribute('href')).toBe(
      '/personal_finance/accounts/2',
    );
  });

  it('should render credit card as a human-readable type label', async () => {
    listAccounts.mockReturnValue(
      of([
        {
          id: 3,
          name: 'Travel Card',
          account_type: 'credit_card',
          currency: 'EUR',
          current_balance: '0.00',
          created_at: '2026-01-03T00:00:00',
        },
      ]),
    );

    const { compiled } = await render();
    expect(compiled.textContent).toContain('Credit card');
    expect(compiled.textContent).not.toContain('credit_card');
  });

  it('should render a negative current balance', async () => {
    listAccounts.mockReturnValue(
      of([
        {
          id: 4,
          name: 'Credit Card',
          account_type: 'credit_card',
          currency: 'EUR',
          current_balance: '-150.00',
          created_at: '2026-01-04T00:00:00',
        },
      ]),
    );

    const { compiled } = await render();
    expect(compiled.textContent).toMatch(/-€?\s?150\.00|€-150\.00/);
  });

  it('should show an empty state with an enabled create action', async () => {
    listAccounts.mockReturnValue(of([]));

    const { compiled } = await render();
    const createButton = compiled.querySelector(
      '.create-account-button',
    ) as HTMLButtonElement | null;

    expect(compiled.querySelector('.data-table')).toBeNull();
    expect(compiled.textContent).toContain('No accounts yet');
    expect(createButton).toBeTruthy();
    expect(createButton?.disabled).toBe(false);
    expect(createButton?.textContent?.trim()).toBe('Create account');
  });

  it('should show an error state and clear stale accounts', async () => {
    const pending = new Subject<Account[]>();
    listAccounts.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Accounts);
    fixture.detectChanges();

    pending.error(new Error('network'));
    fixture.changeDetectorRef.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.loading).toBe(false);
    expect(fixture.componentInstance.accounts).toEqual([]);
    expect(compiled.querySelector('.data-table')).toBeNull();
    expect(compiled.textContent).toContain('Unable to load accounts.');
    expect(compiled.textContent).not.toContain('Demo Main Account');
  });

  it('should open the create form with the expected initial state', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    expect(component.formOpen).toBe(true);
    expect(component.formName).toBe('');
    expect(component.formAccountType).toBe('');
    expect(component.formCurrency).toBe('EUR');
    expect(component.formBalance).toBe('0.00');
    expect(compiled.querySelector('select[name="currency"]')?.textContent).toContain(
      'EUR',
    );
    expect(
      (compiled.querySelector('select[name="currency"]') as HTMLSelectElement)
        .value,
    ).toBe('EUR');
    expect(component.canSubmit).toBe(false);
  });

  it('should reject an empty or whitespace-only name', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = '   ';
    component.formAccountType = 'bank';
    component.formBalance = '0.00';

    expect(component.canSubmit).toBe(false);
    component.saveAccount();
    fixture.changeDetectorRef.detectChanges();

    expect(createAccount).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('Enter an account name.');
  });

  it('should reject a missing account type', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Main Account';
    component.formAccountType = '';
    component.formBalance = '0.00';

    expect(component.canSubmit).toBe(false);
    component.saveAccount();
    fixture.changeDetectorRef.detectChanges();

    expect(createAccount).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('Select an account type.');
  });

  it('should default the currency to EUR', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    expect(component.formCurrency).toBe('EUR');
    expect(
      (compiled.querySelector('select[name="currency"]') as HTMLSelectElement)
        .value,
    ).toBe('EUR');
  });

  it('should accept a negative balance and post backend enum values with a number', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Travel Card';
    component.formAccountType = 'credit_card';
    component.formCurrency = 'EUR';
    component.formBalance = '-150';

    expect(component.canSubmit).toBe(true);
    component.saveAccount();

    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(createAccount).toHaveBeenCalledWith({
      name: 'Travel Card',
      account_type: 'credit_card',
      currency: 'EUR',
      current_balance: -150,
    });
  });

  it('should reject a balance with more than two decimal places', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Main Account';
    component.formAccountType = 'bank';
    component.formBalance = '1.234';

    expect(component.canSubmit).toBe(false);
    component.saveAccount();
    fixture.changeDetectorRef.detectChanges();

    expect(createAccount).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain(
      'Enter a balance with at most two decimal places.',
    );
  });

  it('should refresh the list after a successful create', async () => {
    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    listAccounts.mockReturnValue(of([createdAccount, ...sampleAccounts]));

    component.formName = 'Travel Card';
    component.formAccountType = 'credit_card';
    component.formBalance = '-150';
    component.saveAccount();
    await fixture.whenStable();
    fixture.changeDetectorRef.detectChanges();

    expect(component.formOpen).toBe(false);
    expect(listAccounts).toHaveBeenCalledTimes(2);
    expect(compiled.textContent).toContain('Account created.');
    expect(compiled.textContent).toContain('Travel Card');
    expect(compiled.querySelector('.account-form')).toBeNull();
  });

  it('should show a friendly error when create fails', async () => {
    createAccount.mockReturnValue(throwError(() => new Error('500 boom')));

    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Travel Card';
    component.formAccountType = 'credit_card';
    component.formBalance = '-150';
    component.saveAccount();
    fixture.changeDetectorRef.detectChanges();

    expect(compiled.textContent).toContain('Unable to create account.');
    expect(compiled.textContent).not.toContain('500 boom');
    expect(component.formOpen).toBe(true);
  });

  it('should not submit again while a create request is in progress', async () => {
    const pending = new Subject<Account>();
    createAccount.mockReturnValue(pending.asObservable());

    const { fixture, compiled, component } = await render();
    openCreateForm(fixture, compiled);

    component.formName = 'Travel Card';
    component.formAccountType = 'credit_card';
    component.formBalance = '-150';
    component.saveAccount();
    fixture.changeDetectorRef.detectChanges();

    expect(component.saving).toBe(true);
    expect(component.canSubmit).toBe(false);
    expect(compiled.textContent).toContain('Creating...');

    component.saveAccount();
    expect(createAccount).toHaveBeenCalledTimes(1);

    pending.next(createdAccount);
    pending.complete();
  });
});
