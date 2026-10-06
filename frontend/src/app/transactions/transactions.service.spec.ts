import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Transaction, TransactionWrite } from './transactions-response';
import { TransactionService } from './transactions.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpTesting: HttpTestingController;

  const sample: Transaction = {
    id: 1,
    account_id: 2,
    description: 'Supermercado',
    amount: '52.40',
    transaction_type: 'expense',
    occurred_on: '2026-10-01',
    category: 'Food',
    created_at: '2026-10-01T00:00:00',
  };

  const writePayload: TransactionWrite = {
    account_id: 2,
    description: 'Supermercado',
    amount: '52.40',
    transaction_type: 'expense',
    occurred_on: '2026-10-01',
    category: 'Food',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request the transaction list', () => {
    const expected: Transaction[] = [sample];

    let actual: Transaction[] | undefined;
    service.listTransactions().subscribe((transactions) => {
      actual = transactions;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/transactions',
    );
    expect(request.request.method).toBe('GET');

    request.flush(expected);

    expect(actual).toEqual(expected);
    expect(actual?.[0]?.amount).toBe('52.40');
  });

  it('should request a transaction by id', () => {
    let actual: Transaction | undefined;
    service.getTransaction(1).subscribe((transaction) => {
      actual = transaction;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/transactions/1',
    );
    expect(request.request.method).toBe('GET');

    request.flush(sample);

    expect(actual).toEqual(sample);
  });

  it('should create a transaction', () => {
    let actual: Transaction | undefined;
    service.createTransaction(writePayload).subscribe((transaction) => {
      actual = transaction;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/transactions',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(writePayload);

    request.flush(sample);

    expect(actual).toEqual(sample);
    expect(actual?.amount).toBe('52.40');
  });

  it('should fully update a transaction', () => {
    const updatePayload: TransactionWrite = {
      account_id: 3,
      description: 'Salário',
      amount: '2000.00',
      transaction_type: 'income',
      occurred_on: '2026-10-05',
      category: 'Salary',
    };
    const updated: Transaction = {
      ...sample,
      ...updatePayload,
    };

    let actual: Transaction | undefined;
    service.updateTransaction(1, updatePayload).subscribe((transaction) => {
      actual = transaction;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/transactions/1',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updatePayload);

    request.flush(updated);

    expect(actual).toEqual(updated);
    expect(actual?.amount).toBe('2000.00');
  });

  it('should delete a transaction with an empty 204 response', () => {
    let completed = false;
    service.deleteTransaction(1).subscribe({
      complete: () => {
        completed = true;
      },
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/transactions/1',
    );
    expect(request.request.method).toBe('DELETE');

    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });
});
