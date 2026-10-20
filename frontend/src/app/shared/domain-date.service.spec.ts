import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { DomainDateService } from './domain-date.service';

describe('DomainDateService', () => {
  let service: DomainDateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DomainDateService);
    httpMock = TestBed.inject(HttpTestingController);
    service.resetForTests();
  });

  afterEach(() => {
    httpMock.verify();
    service.resetForTests();
  });

  it('should load and cache current_domain_date from GET /health', () => {
    let first: string | null = undefined as unknown as string | null;
    let second: string | null = undefined as unknown as string | null;

    service.loadCurrentDomainDate().subscribe((iso) => {
      first = iso;
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    expect(req.request.method).toBe('GET');
    req.flush({
      status: 'ok',
      current_domain_date: '2026-10-20',
    });

    service.loadCurrentDomainDate().subscribe((iso) => {
      second = iso;
    });
    httpMock.expectNone(`${environment.apiBaseUrl}/health`);

    expect(first).toBe('2026-10-20');
    expect(second).toBe('2026-10-20');
  });

  it('should return null when health fails', () => {
    let iso: string | null = 'pending' as unknown as string | null;
    service.loadCurrentDomainDate().subscribe((value) => {
      iso = value;
    });
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    req.error(new ProgressEvent('error'));

    expect(iso).toBeNull();
  });
});
