import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';
import { AnalysisSummary } from './analysis-summary';

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  constructor(private http: HttpClient) {}

  getSummary(from: string, to: string): Observable<AnalysisSummary> {
    const params = new HttpParams().set('from', from).set('to', to);

    return this.http.get<AnalysisSummary>(
      `${API_BASE_URL}/analysis/summary`,
      { params },
    );
  }
}
