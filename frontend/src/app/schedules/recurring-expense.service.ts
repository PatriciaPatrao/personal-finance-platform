import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  RecurringExpense,
  RecurringExpenseWrite,
} from './recurring-expense';
import {
  ScheduleExecution,
  ScheduleExecutionOutcome,
} from './schedule-execution';

@Injectable({
  providedIn: 'root',
})
export class RecurringExpenseService {
  private readonly recurringExpensesUrl = `${environment.apiBaseUrl}/recurring-expenses`;

  constructor(private http: HttpClient) {}

  listRecurringExpenses(): Observable<RecurringExpense[]> {
    return this.http.get<RecurringExpense[]>(this.recurringExpensesUrl);
  }

  createRecurringExpense(
    data: RecurringExpenseWrite,
  ): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(
      this.recurringExpensesUrl,
      data,
    );
  }

  updateRecurringExpense(
    recurringExpenseId: number,
    data: RecurringExpenseWrite,
  ): Observable<RecurringExpense> {
    return this.http.put<RecurringExpense>(
      `${this.recurringExpensesUrl}/${recurringExpenseId}`,
      data,
    );
  }

  executeRecurringExpense(
    recurringExpenseId: number,
    occurrenceDate: string,
  ): Observable<ScheduleExecutionOutcome> {
    return this.http
      .post<ScheduleExecution>(
        `${this.recurringExpensesUrl}/${recurringExpenseId}/executions`,
        { occurrence_date: occurrenceDate },
        { observe: 'response' },
      )
      .pipe(
        map((response) => ({
          execution: response.body as ScheduleExecution,
          created: response.status === 201,
        })),
      );
  }
}
