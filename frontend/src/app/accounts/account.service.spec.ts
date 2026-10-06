import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Account, AccountCreate } from './account';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let httpTesting: HttpTestingController;

  const sample: Account = {
    id: 1,
    name: 'Demo Main Account',
    account_type: 'bank',
    currency: 'EUR',
    current_balance: '5000.00',
    created_at: '2026-01-01T00:00:00',
  };

  const createPayload: AccountCreate = {
    name: 'Demo Main Account',
    account_type: 'bank',
    currency: 'EUR',
    current_balance: 5000,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request the account list', () => {
    const expected: Account[] = [sample];

    let actual: Account[] | undefined;
    service.listAccounts().subscribe((accounts) => {
      actual = accounts;
    });

    const request = httpTesting.expectOne('http://127.0.0.1:8000/accounts');
    expect(request.request.method).toBe('GET');

    request.flush(expected);

    expect(actual).toEqual(expected);
    expect(actual?.[0]?.current_balance).toBe('5000.00');
  });

  it('should request an account by id', () => {
    let actual: Account | undefined;
    service.getAccount(1).subscribe((account) => {
      actual = account;
    });

    const request = httpTesting.expectOne('http://127.0.0.1:8000/accounts/1');
    expect(request.request.method).toBe('GET');

    request.flush(sample);

    expect(actual).toEqual(sample);
  });

  it('should create an account', () => {
    let actual: Account | undefined;
    service.createAccount(createPayload).subscribe((account) => {
      actual = account;
    });

    const request = httpTesting.expectOne('http://127.0.0.1:8000/accounts');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createPayload);

    request.flush(sample);

    expect(actual).toEqual(sample);
    expect(actual?.current_balance).toBe('5000.00');
  });
});
