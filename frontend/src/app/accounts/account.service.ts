import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Account } from './account';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  constructor(private http: HttpClient) {}

  listAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${environment.apiBaseUrl}/accounts`);
  }
}
