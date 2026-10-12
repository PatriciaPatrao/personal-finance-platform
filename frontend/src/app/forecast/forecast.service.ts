import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ForecastGroupBy, ForecastResponse } from './forecast-response';

@Injectable({
  providedIn: 'root',
})
export class ForecastService {
  constructor(private http: HttpClient) {}

  getForecast(
    from: string,
    to: string,
    groupBy: ForecastGroupBy,
    accountId?: number,
    groupByOverrides?: Record<string, ForecastGroupBy>,
  ): Observable<ForecastResponse> {
    let params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('group_by', groupBy);
    if (groupByOverrides && Object.keys(groupByOverrides).length > 0) {
      params = params.set(
        'group_by_overrides',
        JSON.stringify(groupByOverrides),
      );
    }
    if (accountId !== undefined) {
      params = params.set('account_id', String(accountId));
    }

    return this.http.get<ForecastResponse>(
      `${environment.apiBaseUrl}/forecast`,
      { params },
    );
  }
}
