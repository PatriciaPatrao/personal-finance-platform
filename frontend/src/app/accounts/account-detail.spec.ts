import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Account } from './account';
import { AccountDetail } from './account-detail';
import { AccountService } from './account.service';

describe('AccountDetail', () => {
  const sampleAccount: Account = {
    id: 4,
    name: 'Travel Card',
    account_type: 'credit_card',
    currency: 'EUR',
    current_balance: '-150.00',
    created_at: '2026-01-04T12:30:00',
  };

  let getAccount: ReturnType<typeof vi.fn>;

  async function configure(routeId: string): Promise<void> {
    getAccount = vi.fn().mockReturnValue(of(sampleAccount));

    await TestBed.configureTestingModule({
      imports: [AccountDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: routeId }),
            },
          },
        },
        {
          provide: AccountService,
          useValue: { getAccount },
        },
      ],
    }).compileComponents();
  }

  async function render(): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<AccountDetail>>;
    compiled: HTMLElement;
    component: AccountDetail;
  }> {
    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      compiled: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance,
    };
  }

  it('should load and display the account fields', async () => {
    await configure('4');
    const { compiled } = await render();

    expect(getAccount).toHaveBeenCalledWith(4);
    expect(compiled.querySelector('h1')?.textContent).toContain('Travel Card');
    expect(compiled.textContent).toContain('Credit card');
    expect(compiled.textContent).toContain('EUR');
    expect(compiled.textContent).toContain('04-01-2026');
    expect(compiled.textContent).toContain(
      'Current balance is the stored account position',
    );
    expect(compiled.textContent).not.toContain('credit_card');
  });

  it('should format a negative balance with the account currency', async () => {
    await configure('4');
    const { compiled } = await render();

    expect(compiled.textContent).toMatch(/-€?\s?150\.00|€-150\.00/);
  });

  it('should show loading until the account arrives', async () => {
    await configure('4');
    const pending = new Subject<Account>();
    getAccount.mockReturnValue(pending.asObservable());

    const fixture = TestBed.createComponent(AccountDetail);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.loading).toBe(true);
    expect(compiled.textContent).toContain('Loading account...');

    pending.next(sampleAccount);
    pending.complete();
    fixture.changeDetectorRef.detectChanges();

    expect(fixture.componentInstance.loading).toBe(false);
    expect(compiled.textContent).not.toContain('Loading account...');
    expect(compiled.querySelector('h1')?.textContent).toContain('Travel Card');
  });

  it('should show an error and keep a back link when loading fails', async () => {
    await configure('4');
    getAccount.mockReturnValue(throwError(() => new Error('404 not found')));

    const { compiled, component } = await render();

    expect(component.account).toBeNull();
    expect(compiled.querySelector('h1')).toBeNull();
    expect(compiled.textContent).toContain('Unable to load this account.');
    expect(compiled.textContent).not.toContain('Travel Card');
    expect(compiled.textContent).not.toContain('404 not found');
    expect(
      compiled.querySelector('a[href="/personal_finance/accounts"]'),
    ).toBeTruthy();
  });

  it('should not call the API for a non-numeric id', async () => {
    await configure('not-an-id');
    const { compiled, component } = await render();

    expect(getAccount).not.toHaveBeenCalled();
    expect(component.loading).toBe(false);
    expect(component.account).toBeNull();
    expect(compiled.textContent).toContain('Unable to load this account.');
    expect(
      compiled.querySelector('a[href="/personal_finance/accounts"]'),
    ).toBeTruthy();
  });
});
