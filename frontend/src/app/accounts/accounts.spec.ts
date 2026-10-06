import { TestBed } from '@angular/core/testing';
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

  let listAccounts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));

    await TestBed.configureTestingModule({
      imports: [Accounts],
      providers: [
        {
          provide: AccountService,
          useValue: { listAccounts },
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

  it('should show an empty state with a disabled create action', async () => {
    listAccounts.mockReturnValue(of([]));

    const { compiled } = await render();
    const createButton = compiled.querySelector(
      '.create-account-button',
    ) as HTMLButtonElement | null;

    expect(compiled.querySelector('.data-table')).toBeNull();
    expect(compiled.textContent).toContain('No accounts yet');
    expect(createButton).toBeTruthy();
    expect(createButton?.disabled).toBe(true);
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
});
