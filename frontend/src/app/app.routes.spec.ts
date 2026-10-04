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

  function navHrefs(compiled: HTMLElement): (string | null)[] {
    return [...compiled.querySelectorAll('header nav a')].map((el) =>
      el.getAttribute('href'),
    );
  }

  function activeNavHref(compiled: HTMLElement): string | null {
    return compiled.querySelector('nav a.active')?.getAttribute('href') ?? null;
  }

  it('redirects / to /personal_finance', async () => {
    const { compiled, router } = await renderAt('/');
    expect(router.url).toBe('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Personal Finance',
    );
  });

  it('renders the Personal Finance dashboard at /personal_finance', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(compiled.querySelector('main h1')?.textContent).toContain(
      'Personal Finance',
    );
  });

  it('renders the Analysis page at /personal_finance/analysis', async () => {
    const { compiled } = await renderAt('/personal_finance/analysis');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Analysis');
  });

  it('renders the Forecast page at /personal_finance/forecast', async () => {
    const { compiled } = await renderAt('/personal_finance/forecast');
    expect(compiled.querySelector('main h1')?.textContent).toContain('Forecast');
  });

  it('has Personal Finance navigation links', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(navHrefs(compiled)).toEqual([
      '/personal_finance',
      '/personal_finance/analysis',
      '/personal_finance/forecast',
    ]);
  });

  it('marks Dashboard as the active tab on /personal_finance', async () => {
    const { compiled } = await renderAt('/personal_finance');
    expect(activeNavHref(compiled)).toBe('/personal_finance');
  });

  it('marks Analysis as the active tab on /personal_finance/analysis', async () => {
    const { compiled } = await renderAt('/personal_finance/analysis');
    expect(activeNavHref(compiled)).toBe('/personal_finance/analysis');
  });

  it('marks Forecast as the active tab on /personal_finance/forecast', async () => {
    const { compiled } = await renderAt('/personal_finance/forecast');
    expect(activeNavHref(compiled)).toBe('/personal_finance/forecast');
  });
});
