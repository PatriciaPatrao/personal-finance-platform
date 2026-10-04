import { TestBed } from '@angular/core/testing';
import { Forecast } from './forecast';

describe('Forecast', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Forecast],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Forecast);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the Forecast heading', async () => {
    const fixture = TestBed.createComponent(Forecast);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Forecast');
  });
});
