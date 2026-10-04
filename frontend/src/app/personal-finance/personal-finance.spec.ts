import { TestBed } from '@angular/core/testing';
import { PersonalFinance } from './personal-finance';

describe('PersonalFinance', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalFinance],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the Personal Finance Platform heading', async () => {
    const fixture = TestBed.createComponent(PersonalFinance);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Personal Finance Platform',
    );
  });
});
