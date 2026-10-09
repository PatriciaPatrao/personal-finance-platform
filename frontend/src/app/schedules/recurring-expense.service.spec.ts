import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  RecurringExpense,
  RecurringExpenseWrite,
} from './recurring-expense';
import { RecurringExpenseService } from './recurring-expense.service';

describe('RecurringExpenseService', () => {
  let service: RecurringExpenseService;
  let httpMock: HttpTestingController;

  const sampleExpense: RecurringExpense = {
    id: 5,
    account_id: 2,
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

  const fullWrite: RecurringExpenseWrite = {
    account_id: 2,
    description: 'Rent',
    amount: 900,
    category: 'Housing',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: '2026-02-01',
    end_date: null,
    active: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecurringExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list recurring expenses', () => {
    let actual: RecurringExpense[] | undefined;
    service.listRecurringExpenses().subscribe((expenses) => {
      actual = expenses;
    });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/recurring-expenses',
    );
    expect(request.request.method).toBe('GET');
    request.flush([sampleExpense]);
    expect(actual).toEqual([sampleExpense]);
  });

  it('should create a recurring expense', () => {
    let actual: RecurringExpense | undefined;
    service.createRecurringExpense(fullWrite).subscribe((expense) => {
      actual = expense;
    });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/recurring-expenses',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(fullWrite);
    request.flush(sampleExpense);
    expect(actual).toEqual(sampleExpense);
  });

  it('should update a recurring expense with every required field', () => {
    const deactivatePayload: RecurringExpenseWrite = {
      account_id: 2,
      description: 'Rent',
      amount: 950,
      category: null,
      frequency: 'yearly',
      start_date: '2026-01-01',
      next_occurrence: '2027-01-01',
      end_date: '2028-01-01',
      active: false,
    };

    let actual: RecurringExpense | undefined;
    service
      .updateRecurringExpense(5, deactivatePayload)
      .subscribe((expense) => {
        actual = expense;
      });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/recurring-expenses/5',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(deactivatePayload);
    expect(Object.keys(request.request.body).sort()).toEqual([
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
    request.flush({
      ...sampleExpense,
      ...deactivatePayload,
      amount: '950.00',
    });
    expect(actual?.active).toBe(false);
    expect(actual?.category).toBeNull();
  });
});
