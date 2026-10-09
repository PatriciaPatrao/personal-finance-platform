import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Income, IncomeWrite } from './income';

@Injectable({
  providedIn: 'root',
})
export class IncomeService {
  private readonly incomesUrl = `${environment.apiBaseUrl}/incomes`;

  constructor(private http: HttpClient) {}

  listIncomes(): Observable<Income[]> {
    return this.http.get<Income[]>(this.incomesUrl);
  }

  createIncome(data: IncomeWrite): Observable<Income> {
    return this.http.post<Income>(this.incomesUrl, data);
  }

  updateIncome(incomeId: number, data: IncomeWrite): Observable<Income> {
    return this.http.put<Income>(`${this.incomesUrl}/${incomeId}`, data);
  }
}
