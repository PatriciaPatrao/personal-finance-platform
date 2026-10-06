import { TestBed } from '@angular/core/testing';

import { Transactions } from './transactions';

describe('Transactions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Transactions],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Transactions);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Transactions heading', () => {
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Transactions',
    );
  });
});
