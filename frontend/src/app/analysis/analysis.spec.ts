import { TestBed } from '@angular/core/testing';
import { Analysis } from './analysis';

describe('Analysis', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Analysis],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Analysis);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the Analysis heading', async () => {
    const fixture = TestBed.createComponent(Analysis);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Analysis');
  });
});
