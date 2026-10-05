import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AnalysisSummary,
  CashFlow,
  CashFlowGroupBy,
  ExpensesByCategory,
} from './analysis-summary';

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  constructor(private http: HttpClient) {}

  getSummary(from: string, to: string): Observable<AnalysisSummary> {
    const params = new HttpParams().set('from', from).set('to', to);

    return this.http.get<AnalysisSummary>(
      `${environment.apiBaseUrl}/analysis/summary`,
      { params },
    );
  }

  getExpenses(from: string, to: string): Observable<ExpensesByCategory> {
    const params = new HttpParams().set('from', from).set('to', to);

    return this.http.get<ExpensesByCategory>(
      `${environment.apiBaseUrl}/analysis/expenses`,
      { params },
    );
  }

  getCashFlow(
    from: string,
    to: string,
    groupBy: CashFlowGroupBy,
  ): Observable<CashFlow> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('group_by', groupBy);

    return this.http.get<CashFlow>(
      `${environment.apiBaseUrl}/analysis/cash-flow`,
      { params },
    );
  }
}
