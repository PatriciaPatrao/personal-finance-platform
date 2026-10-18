import { provideHttpClient } from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Income, IncomeWrite } from './income';
import { IncomeService } from './income.service';

describe('IncomeService', () => {
  let service: IncomeService;
  let httpMock: HttpTestingController;

  const sampleIncome: Income = {
    id: 1,
    account_id: 2,
    amount: '2500.00',
    frequency: 'monthly',
    start_date: '2026-01-01',
    next_occurrence: '2026-02-01',
    end_date: null,
    active: true,
    created_at: '2026-01-01T00:00:00',
  };

  const fullWrite: IncomeWrite = {
    account_id: 2,
    amount: 2500,
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
    service = TestBed.inject(IncomeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list incomes', () => {
    let actual: Income[] | undefined;
    service.listIncomes().subscribe((incomes) => {
      actual = incomes;
    });

    const request = httpMock.expectOne('http://127.0.0.1:8000/incomes');
    expect(request.request.method).toBe('GET');
    request.flush([sampleIncome]);
    expect(actual).toEqual([sampleIncome]);
  });

  it('should create an income', () => {
    let actual: Income | undefined;
    service.createIncome(fullWrite).subscribe((income) => {
      actual = income;
    });

    const request = httpMock.expectOne('http://127.0.0.1:8000/incomes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(fullWrite);
    request.flush(sampleIncome);
    expect(actual).toEqual(sampleIncome);
  });

  it('should update an income with every required field', () => {
    const deactivatePayload: IncomeWrite = {
      account_id: 2,
      amount: 2600,
      frequency: 'weekly',
      start_date: '2026-01-01',
      next_occurrence: '2026-02-08',
      end_date: '2026-12-31',
      active: false,
    };

    let actual: Income | undefined;
    service.updateIncome(1, deactivatePayload).subscribe((income) => {
      actual = income;
    });

    const request = httpMock.expectOne('http://127.0.0.1:8000/incomes/1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(deactivatePayload);
    expect(Object.keys(request.request.body).sort()).toEqual([
      'account_id',
      'active',
      'amount',
      'end_date',
      'frequency',
      'next_occurrence',
      'start_date',
    ]);
    request.flush({ ...sampleIncome, ...deactivatePayload, amount: '2600.00' });
    expect(actual?.active).toBe(false);
  });

  it('should execute an income occurrence and report created status', () => {
    let created: boolean | undefined;
    service.executeIncome(1, '2026-02-01').subscribe((outcome) => {
      created = outcome.created;
    });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/incomes/1/executions',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ occurrence_date: '2026-02-01' });
    request.flush(
      {
        id: 5,
        source_type: 'income',
        source_id: 1,
        occurrence_date: '2026-02-01',
        transaction_id: 9,
        created_at: '2026-02-01T12:00:00',
        transaction_account_id: 2,
        transaction_amount: '2500.00',
        transaction_type: 'income',
        transaction_occurred_on: '2026-02-01',
      },
      { status: 201, statusText: 'Created' },
    );
    expect(created).toBe(true);
  });

  it('should treat idempotent execution replay as not created', () => {
    let created: boolean | undefined;
    service.executeIncome(1, '2026-02-01').subscribe((outcome) => {
      created = outcome.created;
    });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/incomes/1/executions',
    );
    request.event(
      new HttpResponse({
        status: 200,
        body: {
          id: 5,
          source_type: 'income',
          source_id: 1,
          occurrence_date: '2026-02-01',
          transaction_id: 9,
          created_at: '2026-02-01T12:00:00',
          transaction_account_id: 2,
          transaction_amount: '2500.00',
          transaction_type: 'income',
          transaction_occurred_on: '2026-02-01',
        },
      }),
    );
    expect(created).toBe(false);
  });
});
