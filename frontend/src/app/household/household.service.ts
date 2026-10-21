import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface HouseholdMe {
  household_id: number;
  user_sub: string;
  role: string;
}

export interface HouseholdInvitationCreated {
  token: string;
  expires_at: string;
}

export interface HouseholdMemberResponse {
  id: number;
  household_id: number;
  user_sub: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/households`;

  getMe(): Observable<HouseholdMe> {
    return this.http.get<HouseholdMe>(`${this.baseUrl}/me`);
  }

  createInvitation(): Observable<HouseholdInvitationCreated> {
    return this.http.post<HouseholdInvitationCreated>(
      `${this.baseUrl}/invitations`,
      {},
    );
  }

  acceptInvitation(token: string): Observable<HouseholdMemberResponse> {
    return this.http.post<HouseholdMemberResponse>(
      `${this.baseUrl}/invitations/accept`,
      { token },
    );
  }
}
