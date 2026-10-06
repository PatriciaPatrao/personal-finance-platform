import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Account, AccountCreate } from './account';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private readonly accountsUrl = `${environment.apiBaseUrl}/accounts`;

  constructor(private http: HttpClient) {}

  listAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.accountsUrl);
  }

  getAccount(accountId: number): Observable<Account> {
    return this.http.get<Account>(`${this.accountsUrl}/${accountId}`);
  }

  createAccount(data: AccountCreate): Observable<Account> {
    return this.http.post<Account>(this.accountsUrl, data);
  }
}
