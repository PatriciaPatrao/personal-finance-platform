import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  FinancialGoal,
  FinancialGoalWrite,
  GoalAllocationCreate,
  GoalAllocationUpdate,
} from './goal';

@Injectable({
  providedIn: 'root',
})
export class GoalService {
  private readonly goalsUrl = `${environment.apiBaseUrl}/financial-goals`;

  constructor(private http: HttpClient) {}

  listGoals(): Observable<FinancialGoal[]> {
    return this.http.get<FinancialGoal[]>(this.goalsUrl);
  }

  createGoal(data: FinancialGoalWrite): Observable<FinancialGoal> {
    return this.http.post<FinancialGoal>(this.goalsUrl, data);
  }

  updateGoal(
    goalId: number,
    data: FinancialGoalWrite,
  ): Observable<FinancialGoal> {
    return this.http.put<FinancialGoal>(
      `${this.goalsUrl}/${goalId}`,
      data,
    );
  }

  createAllocation(
    goalId: number,
    data: GoalAllocationCreate,
  ): Observable<FinancialGoal> {
    return this.http.post<FinancialGoal>(
      `${this.goalsUrl}/${goalId}/allocations`,
      data,
    );
  }

  updateAllocation(
    goalId: number,
    allocationId: number,
    data: GoalAllocationUpdate,
  ): Observable<FinancialGoal> {
    return this.http.put<FinancialGoal>(
      `${this.goalsUrl}/${goalId}/allocations/${allocationId}`,
      data,
    );
  }

  deleteAllocation(
    goalId: number,
    allocationId: number,
  ): Observable<FinancialGoal> {
    return this.http.delete<FinancialGoal>(
      `${this.goalsUrl}/${goalId}/allocations/${allocationId}`,
    );
  }
}
