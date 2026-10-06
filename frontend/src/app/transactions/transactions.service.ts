import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Transaction, TransactionWrite } from './transactions-response';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  constructor(private http: HttpClient) {}

  listTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(
      `${environment.apiBaseUrl}/transactions`,
    );
  }

  getTransaction(transactionId: number): Observable<Transaction> {
    return this.http.get<Transaction>(
      `${environment.apiBaseUrl}/transactions/${transactionId}`,
    );
  }

  createTransaction(data: TransactionWrite): Observable<Transaction> {
    return this.http.post<Transaction>(
      `${environment.apiBaseUrl}/transactions`,
      data,
    );
  }

  updateTransaction(
    transactionId: number,
    data: TransactionWrite,
  ): Observable<Transaction> {
    return this.http.put<Transaction>(
      `${environment.apiBaseUrl}/transactions/${transactionId}`,
      data,
    );
  }

  deleteTransaction(transactionId: number): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/transactions/${transactionId}`,
    );
  }
}
