import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FinancialGoal } from './goal';
import { GoalService } from './goal.service';

describe('GoalService', () => {
  let service: GoalService;
  let httpMock: HttpTestingController;

  const sampleGoal: FinancialGoal = {
    id: 1,
    name: 'Emergency Fund',
    target_amount: '10000.00',
    currency: 'EUR',
    target_date: null,
    created_at: '2026-01-01T00:00:00',
    allocations: [],
    current_amount: null,
    progress: null,
    completed: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list goals', () => {
    let actual: FinancialGoal[] | undefined;
    service.listGoals().subscribe((goals) => {
      actual = goals;
    });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals',
    );
    expect(request.request.method).toBe('GET');
    request.flush([sampleGoal]);
    expect(actual).toEqual([sampleGoal]);
  });

  it('should create a goal', () => {
    let actual: FinancialGoal | undefined;
    service
      .createGoal({
        name: 'Emergency Fund',
        target_amount: 10000,
        currency: 'EUR',
        target_date: null,
      })
      .subscribe((goal) => {
        actual = goal;
      });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Emergency Fund',
      target_amount: 10000,
      currency: 'EUR',
      target_date: null,
    });
    request.flush(sampleGoal);
    expect(actual).toEqual(sampleGoal);
  });

  it('should update a goal', () => {
    let actual: FinancialGoal | undefined;
    service
      .updateGoal(1, {
        name: 'Rainy Day',
        target_amount: 12000,
        currency: 'EUR',
        target_date: null,
      })
      .subscribe((goal) => {
        actual = goal;
      });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals/1',
    );
    expect(request.request.method).toBe('PUT');
    request.flush({ ...sampleGoal, name: 'Rainy Day' });
    expect(actual?.name).toBe('Rainy Day');
  });

  it('should create an allocation', () => {
    let actual: FinancialGoal | undefined;
    service
      .createAllocation(1, { account_id: 2, amount: 500 })
      .subscribe((goal) => {
        actual = goal;
      });

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals/1/allocations',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      account_id: 2,
      amount: 500,
    });
    request.flush(sampleGoal);
    expect(actual).toEqual(sampleGoal);
  });

  it('should update an allocation', () => {
    service
      .updateAllocation(1, 9, { amount: 250 })
      .subscribe();

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals/1/allocations/9',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ amount: 250 });
    request.flush(sampleGoal);
  });

  it('should delete an allocation', () => {
    service.deleteAllocation(1, 9).subscribe();

    const request = httpMock.expectOne(
      'http://127.0.0.1:8000/financial-goals/1/allocations/9',
    );
    expect(request.request.method).toBe('DELETE');
    request.flush(sampleGoal);
  });
});
