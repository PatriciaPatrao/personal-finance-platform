import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { Account } from '../accounts/account';
import { AccountService } from '../accounts/account.service';
import { Transaction } from './transactions-response';
import {
  Transactions,
  UNCATEGORIZED_FILTER,
} from './transactions';
import { TransactionService } from './transactions.service';

describe('Transactions', () => {
  const sampleAccounts: Account[] = [
    {
      id: 1,
      name: 'Demo Main Account',
      account_type: 'bank',
      currency: 'EUR',
      current_balance: '5000.00',
      created_at: '2026-01-01T00:00:00',
    },
    {
      id: 2,
      name: 'Cash Wallet',
      account_type: 'cash',
      currency: 'EUR',
      current_balance: '80.00',
      created_at: '2026-01-02T00:00:00',
    },
  ];

  const sampleTransactions: Transaction[] = [
    {
      id: 3,
      account_id: 2,
      description: null,
      amount: '12.00',
      transaction_type: 'expense',
      occurred_on: '2026-10-05',
      category: null,
      created_at: '2026-10-05T00:00:00',
    },
    {
      id: 1,
      account_id: 1,
      description: 'Supermercado',
      amount: '52.40',
      transaction_type: 'expense',
      occurred_on: '2026-10-01',
      category: 'Food',
      created_at: '2026-10-01T00:00:00',
    },
    {
      id: 2,
      account_id: 1,
      description: 'Salário',
      amount: '2000.00',
      transaction_type: 'income',
      occurred_on: '2026-09-15',
      category: 'Salary',
      created_at: '2026-09-15T00:00:00',
    },
  ];

  let listTransactions: ReturnType<typeof vi.fn>;
  let listAccounts: ReturnType<typeof vi.fn>;
  let createTransaction: ReturnType<typeof vi.fn>;
  let updateTransaction: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listTransactions = vi.fn().mockReturnValue(of(sampleTransactions));
    listAccounts = vi.fn().mockReturnValue(of(sampleAccounts));
    createTransaction = vi.fn();
    updateTransaction = vi.fn();

    await TestBed.configureTestingModule({
      imports: [Transactions],
      providers: [
        {
          provide: TransactionService,
          useValue: { listTransactions, createTransaction, updateTransaction },
        },
        {
          provide: AccountService,
          useValue: { listAccounts },
        },
      ],
    }).compileComponents();
  });

  async function render(): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<Transactions>>;
    compiled: HTMLElement;
    component: Transactions;
  }> {
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      compiled: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance,
    };
  }

  function applyFilters(
    compiled: HTMLElement,
    fixture: ReturnType<typeof TestBed.createComponent<Transactions>>,
  ): void {
    (compiled.querySelector('.apply-button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Transactions);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Transactions heading', async () => {
    const { compiled } = await render();
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Transactions',
    );
  });

  it('should request transactions and accounts on init', async () => {
    await render();
    expect(listTransactions).toHaveBeenCalledTimes(1);
    expect(listAccounts).toHaveBeenCalledTimes(1);
  });

  it('should show loading until the transactions arrive', async () => {
    const pending = new Subject<Transaction[]>();
    listTransactions.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading transactions...');

    pending.next(sampleTransactions);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading transactions...');
  });

  it('should display loaded transactions with account names and EUR amounts', async () => {
    const { compiled } = await render();
    const text = compiled.textContent ?? '';

    expect(compiled.querySelector('.data-table')).toBeTruthy();
    expect(text).toContain('01-10-2026');
    expect(text).toContain('15-09-2026');
    expect(text).toContain('05-10-2026');
    expect(text).toContain('Supermercado');
    expect(text).toContain('Salário');
    expect(text).toContain('Demo Main Account');
    expect(text).toContain('Cash Wallet');
    expect(text).toContain('Food');
    expect(text).toContain('Salary');
    expect(text).toContain('Income');
    expect(text).toContain('Expense');
    expect(text).toContain('52.40');
    expect(text).toContain('2,000.00');
    expect(text).toContain('12.00');
    expect(text).not.toContain('-52.40');
    expect(text).not.toContain('-12.00');

    const amountCells = compiled.querySelectorAll('.amount-cell');
    expect(amountCells[0]?.classList.contains('amount-expense')).toBe(true);
    expect(amountCells[2]?.classList.contains('amount-income')).toBe(true);
  });

  it('should show an empty state when no transactions are recorded', async () => {
    listTransactions.mockReturnValue(of([]));

    const { compiled } = await render();
    const text = compiled.textContent ?? '';

    expect(text).toContain('No transactions recorded yet.');
    expect(compiled.querySelector('.data-table')).toBeNull();
  });

  it('should show a user-facing error when the transaction request fails', async () => {
    listTransactions.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const { compiled } = await render();
    const text = compiled.textContent ?? '';

    expect(text).toContain('Unable to load transactions.');
    expect(text).not.toContain('Internal Server Error');
    expect(compiled.querySelector('.data-table')).toBeNull();
  });

  it('should still list transactions when accounts fail to load', async () => {
    listAccounts.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const { compiled } = await render();
    const text = compiled.textContent ?? '';

    expect(compiled.querySelector('.data-table')).toBeTruthy();
    expect(text).toContain('Supermercado');
    expect(text).toContain('Account 1');
    expect(text).toContain('Account 2');
    expect(text).not.toContain('Unable to load transactions.');
  });

  it('should filter by transaction type without refetching', async () => {
    const { fixture, compiled, component } = await render();
    listTransactions.mockClear();

    component.typeDraft = 'income';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(listTransactions).not.toHaveBeenCalled();
    expect(text).toContain('Salário');
    expect(text).toContain('Income');
    expect(text).toContain('2,000.00');
    expect(text).not.toContain('Supermercado');
    expect(text).not.toContain('52.40');
  });

  it('should filter by category', async () => {
    const { fixture, compiled, component } = await render();

    component.categoryDraft = 'Food';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('Supermercado');
    expect(text).toContain('Food');
    expect(text).not.toContain('Salário');
  });

  it('should filter uncategorized transactions', async () => {
    const { fixture, compiled, component } = await render();

    component.categoryDraft = UNCATEGORIZED_FILTER;
    applyFilters(compiled, fixture);

    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('05-10-2026');
    expect(rows[0]?.textContent).toContain('Cash Wallet');
  });

  it('should filter by an inclusive date range', async () => {
    const { fixture, compiled, component } = await render();

    component.fromDisplay = '01-10-2026';
    component.toDisplay = '05-10-2026';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('Supermercado');
    expect(text).toContain('05-10-2026');
    expect(text).not.toContain('Salário');
    expect(text).not.toContain('15-09-2026');
  });

  it('should show an unmatched-filters message when nothing remains', async () => {
    const { fixture, compiled, component } = await render();

    component.typeDraft = 'income';
    component.categoryDraft = 'Food';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('No transactions match these filters.');
    expect(compiled.querySelector('.data-table')).toBeNull();
  });

  it('should keep visible rows when Apply has an invalid date', async () => {
    const { fixture, compiled, component } = await render();

    component.fromDisplay = '32-13-2026';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('Enter dates as DD-MM-YYYY.');
    expect(text).toContain('Supermercado');
    expect(text).toContain('Salário');
    expect(compiled.querySelector('.data-table')).toBeTruthy();
  });

  it('should keep visible rows when From is after To', async () => {
    const { fixture, compiled, component } = await render();

    component.fromDisplay = '05-10-2026';
    component.toDisplay = '01-10-2026';
    applyFilters(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('From must be on or before To.');
    expect(text).toContain('Supermercado');
    expect(text).toContain('Salário');
    expect(compiled.querySelector('.data-table')).toBeTruthy();
  });

  function openCreate(
    compiled: HTMLElement,
    fixture: ReturnType<typeof TestBed.createComponent<Transactions>>,
  ): void {
    (
      compiled.querySelector('.new-transaction-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
  }

  function saveForm(
    compiled: HTMLElement,
    fixture: ReturnType<typeof TestBed.createComponent<Transactions>>,
  ): void {
    (compiled.querySelector('.save-button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('should record a valid transaction and show it in the list', async () => {
    const created: Transaction = {
      id: 9,
      account_id: 1,
      description: 'Cafe',
      amount: '4.50',
      transaction_type: 'expense',
      occurred_on: '2026-10-06',
      category: 'Food',
      created_at: '2026-10-06T00:00:00',
    };
    createTransaction.mockReturnValue(of(created));

    const { fixture, compiled, component } = await render();
    openCreate(compiled, fixture);
    component.formAccountId = '1';
    component.formDescription = 'Cafe';
    component.formAmount = '4.5';
    component.formType = 'expense';
    component.formDateDisplay = '06-10-2026';
    component.formCategory = 'Food';
    saveForm(compiled, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createTransaction).toHaveBeenCalledWith({
      account_id: 1,
      description: 'Cafe',
      amount: '4.50',
      transaction_type: 'expense',
      occurred_on: '2026-10-06',
      category: 'Food',
    });
    const text = compiled.textContent ?? '';
    expect(text).toContain('Transaction recorded.');
    expect(text).toContain('Cafe');
    expect(text).toContain('€4.50');
    expect(compiled.querySelector('.transaction-form')).toBeNull();
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('should keep an invalid form from creating a transaction', async () => {
    const { fixture, compiled, component } = await render();
    openCreate(compiled, fixture);
    saveForm(compiled, fixture);

    expect(compiled.textContent).toContain('Select an account.');
    expect(createTransaction).not.toHaveBeenCalled();

    component.formAccountId = '1';
    component.formDateDisplay = '06-10-2026';
    component.formAmount = '0';
    saveForm(compiled, fixture);

    expect(compiled.textContent).toContain(
      'Enter a positive amount with at most two decimal places.',
    );
    expect(createTransaction).not.toHaveBeenCalled();
    expect(compiled.querySelector('.transaction-form')).toBeTruthy();
  });

  it('should show an API validation error and keep the form open', async () => {
    createTransaction.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            statusText: 'Unprocessable Entity',
            error: {
              detail: [
                {
                  loc: ['body', 'amount'],
                  msg: 'Input should be greater than 0',
                  type: 'greater_than',
                },
              ],
            },
          }),
      ),
    );

    const { fixture, compiled, component } = await render();
    openCreate(compiled, fixture);
    component.formAccountId = '1';
    component.formAmount = '4.50';
    component.formDateDisplay = '06-10-2026';
    component.formType = 'expense';
    saveForm(compiled, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = compiled.textContent ?? '';
    expect(text).toContain('Amount: Input should be greater than 0');
    expect(text).not.toContain('Unprocessable Entity');
    expect(compiled.querySelector('.transaction-form')).toBeTruthy();
    expect(compiled.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('should update an existing transaction', async () => {
    const updated: Transaction = {
      ...sampleTransactions[0],
      description: 'Coffee',
      category: 'Food',
    };
    updateTransaction.mockReturnValue(of(updated));

    const { fixture, compiled, component } = await render();
    (
      compiled.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Edit transaction');
    expect(component.editingId).toBe(3);
    expect(component.formAccountId).toBe('2');
    expect(component.formAmount).toBe('12.00');
    expect(component.formDateDisplay).toBe('05-10-2026');
    expect(component.formType).toBe('expense');

    component.formDescription = 'Coffee';
    component.formCategory = 'Food';
    saveForm(compiled, fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateTransaction).toHaveBeenCalledWith(3, {
      account_id: 2,
      description: 'Coffee',
      amount: '12.00',
      transaction_type: 'expense',
      occurred_on: '2026-10-05',
      category: 'Food',
    });
    expect(createTransaction).not.toHaveBeenCalled();
    const text = compiled.textContent ?? '';
    expect(text).toContain('Transaction updated.');
    expect(text).toContain('Coffee');
    expect(compiled.querySelector('.transaction-form')).toBeNull();
  });

  it('should show an account loading error and block saving', async () => {
    listAccounts.mockReturnValue(
      throwError(() => new Error('Internal Server Error')),
    );

    const { fixture, compiled } = await render();
    openCreate(compiled, fixture);

    const text = compiled.textContent ?? '';
    expect(text).toContain('Unable to load accounts.');
    expect(text).toContain('Supermercado');
    expect(
      (compiled.querySelector('.save-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(createTransaction).not.toHaveBeenCalled();
  });
});
