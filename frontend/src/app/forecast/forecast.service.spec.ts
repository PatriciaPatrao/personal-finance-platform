import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ForecastResponse } from './forecast-response';
import { ForecastService } from './forecast.service';

describe('ForecastService', () => {
  let service: ForecastService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ForecastService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request the forecast for a date range and monthly grouping', () => {
    const expected: ForecastResponse = {
      from_date: '2026-10-05',
      to_date: '2026-12-31',
      scope: 'household',
      account_id: null,
      group_by: 'month',
      projections: [
        {
          currency: 'EUR',
          group_by: 'month',
          starting_balance: '2000.00',
          periods: [
            {
              period: '2026-10',
              income: '2000.00',
              expenses: '1500.00',
              net_cash_flow: '500.00',
              projected_balance: '2500.00',
            },
          ],
        },
      ],
    };

    let actual: ForecastResponse | undefined;
    service
      .getForecast('2026-10-05', '2026-12-31', 'month')
      .subscribe((forecast) => {
        actual = forecast;
      });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/forecast?from=2026-10-05&to=2026-12-31&group_by=month',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.url).toBe('http://127.0.0.1:8000/forecast');
    expect(request.request.params.get('from')).toBe('2026-10-05');
    expect(request.request.params.get('to')).toBe('2026-12-31');
    expect(request.request.params.get('group_by')).toBe('month');

    request.flush(expected);

    expect(actual).toEqual(expected);
    expect(actual?.projections[0].periods[0].projected_balance).toBe(
      '2500.00',
    );
    expect(actual?.projections[0].periods[0].income).toBe('2000.00');
  });

  it('should request the forecast with daily grouping', () => {
    const expected: ForecastResponse = {
      from_date: '2026-10-05',
      to_date: '2026-10-06',
      scope: 'household',
      account_id: null,
      group_by: 'day',
      projections: [
        {
          currency: 'EUR',
          group_by: 'day',
          starting_balance: '1000.00',
          periods: [
            {
              period: '2026-10-05',
              income: '0.00',
              expenses: '0.00',
              net_cash_flow: '0.00',
              projected_balance: '1000.00',
            },
            {
              period: '2026-10-06',
              income: '0.00',
              expenses: '0.00',
              net_cash_flow: '0.00',
              projected_balance: '1000.00',
            },
          ],
        },
      ],
    };

    let actual: ForecastResponse | undefined;
    service
      .getForecast('2026-10-05', '2026-10-06', 'day')
      .subscribe((forecast) => {
        actual = forecast;
      });

    const request = httpTesting.expectOne(
      'http://127.0.0.1:8000/forecast?from=2026-10-05&to=2026-10-06&group_by=day',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('group_by')).toBe('day');

    request.flush(expected);

    expect(actual).toEqual(expected);
    expect(actual?.group_by).toBe('day');
    expect(actual?.projections[0].periods).toHaveLength(2);
  });

  it('should include account_id when requesting an account-scoped forecast', () => {
    const expected: ForecastResponse = {
      from_date: '2026-10-05',
      to_date: '2026-10-05',
      scope: 'account',
      account_id: 3,
      group_by: 'day',
      projections: [
        {
          currency: 'USD',
          group_by: 'day',
          starting_balance: '100.00',
          periods: [],
        },
      ],
    };

    service
      .getForecast('2026-10-05', '2026-10-05', 'day', 3)
      .subscribe((forecast) => {
        expect(forecast).toEqual(expected);
      });

    const request = httpTesting.expectOne((req) =>
      req.url.includes('/forecast'),
    );
    expect(request.request.params.get('account_id')).toBe('3');

    request.flush(expected);
  });
});
