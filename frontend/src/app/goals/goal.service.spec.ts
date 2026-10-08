import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FinancialGoal, FinancialGoalWrite } from './goal';
import { GoalService } from './goal.service';

describe('GoalService', () => {
  let service: GoalService;
  let httpTesting: HttpTestingController;

  const sample: FinancialGoal = {
    id: 1,
    name: 'Emergency Fund',
    target_amount: '10000.00',
    currency: 'EUR',
    target_date: null,
    account_id: null,
    created_at: '2026-01-01T00:00:00',
    current_amount: null,
    progress: null,
    completed: null,
  };

  const writePayload: FinancialGoalWrite = {
    name: 'Emergency Fund',
    target_amount: 10000,
    currency: 'EUR',
    target_date: null,
    account_id: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoalService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request the goal list', () => {
    let actual: FinancialGoal[] | undefined;
    service.listGoals().subscribe((goals) => {
      actual = goals;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/financial-goals',
    );
    expect(request.request.method).toBe('GET');
    request.flush([sample]);
    expect(actual).toEqual([sample]);
  });

  it('should create a goal', () => {
    let actual: FinancialGoal | undefined;
    service.createGoal(writePayload).subscribe((goal) => {
      actual = goal;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/financial-goals',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(writePayload);
    request.flush(sample);
    expect(actual).toEqual(sample);
  });

  it('should update a goal', () => {
    const updated: FinancialGoal = {
      ...sample,
      name: 'Vacation',
      target_amount: '5000.00',
    };
    const payload: FinancialGoalWrite = {
      ...writePayload,
      name: 'Vacation',
      target_amount: 5000,
    };

    let actual: FinancialGoal | undefined;
    service.updateGoal(1, payload).subscribe((goal) => {
      actual = goal;
    });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/financial-goals/1',
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush(updated);
    expect(actual).toEqual(updated);
  });
});
