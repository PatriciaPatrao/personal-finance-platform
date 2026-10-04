import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App routing', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  async function renderAt(url: string): Promise<{
    compiled: HTMLElement;
    router: Router;
  }> {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      compiled: fixture.nativeElement as HTMLElement,
      router,
    };
  }

  it('redirects / to /personal_finance', async () => {
    const { compiled, router } = await renderAt('/');
    expect(router.url).toBe('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Personal Finance Platform',
    );
  });

  it('renders the Personal Finance page at /personal_finance', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Personal Finance Platform',
    );
  });

  it('renders the Analysis page at /analysis', async () => {
    const { compiled } = await renderAt('/analysis');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Analysis');
  });

  it('renders the Forecast page at /forecast', async () => {
    const { compiled } = await renderAt('/forecast');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Forecast');
  });

  it('has header links to personal finance, analysis, and forecast', async () => {
    const { compiled } = await renderAt('/personal_finance');
    const hrefs = [...compiled.querySelectorAll('header nav a')].map((el) =>
      el.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/personal_finance', '/analysis', '/forecast']);
  });
});
