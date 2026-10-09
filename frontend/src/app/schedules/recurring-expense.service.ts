import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  RecurringExpense,
  RecurringExpenseWrite,
} from './recurring-expense';

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
}
