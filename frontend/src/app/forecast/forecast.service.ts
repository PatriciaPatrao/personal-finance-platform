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
  ): Observable<ForecastResponse> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('group_by', groupBy);

    return this.http.get<ForecastResponse>(
      `${environment.apiBaseUrl}/forecast`,
      { params },
    );
  }
}
