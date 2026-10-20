import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { calendarDateToIso } from './calendar-date';

export interface HealthResponse {
  status: string;
  current_domain_date?: string;
}

/**
 * Authoritative application calendar date from the API (schedule execution,
 * forecast as_of). Matches backend `current_domain_date()`.
 */
@Injectable({
  providedIn: 'root',
})
export class DomainDateService {
  private cachedIso: string | null = null;
  private inFlight: Observable<string | null> | null = null;

  constructor(private http: HttpClient) {}

  /** Clears cache (tests). */
  resetForTests(): void {
    this.cachedIso = null;
    this.inFlight = null;
  }

  /**
   * Returns the API current domain date, or null when the health request fails.
   */
  loadCurrentDomainDate(): Observable<string | null> {
    if (this.cachedIso !== null) {
      return of(this.cachedIso);
    }

    if (!this.inFlight) {
      this.inFlight = this.http
        .get<HealthResponse>(`${environment.apiBaseUrl}/health`)
        .pipe(
          map((body) => {
            const iso = body.current_domain_date?.trim();
            if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
              return null;
            }
            return iso;
          }),
          tap((iso) => {
            if (iso !== null) {
              this.cachedIso = iso;
            }
          }),
          catchError(() => of(null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.inFlight;
  }

  /** Client local calendar date; use only when API date is unavailable. */
  localCalendarDateIso(): string {
    return calendarDateToIso(new Date());
  }
}
