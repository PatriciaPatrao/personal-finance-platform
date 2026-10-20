import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';

import { PfpPreset } from '../design-system/pfp-preset';
import { PersonalFinanceLayout } from './personal-finance-layout';

describe('PersonalFinanceLayout', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalFinanceLayout],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        providePrimeNG({
          theme: {
            preset: PfpPreset,
            options: { prefix: 'p', darkModeSelector: false },
          },
        }),
      ],
    }).compileComponents();
  });

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }

  it('should restore focus to the mobile menu button when the drawer hides', async () => {
    const fixture = TestBed.createComponent(PersonalFinanceLayout);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const menuButton = compiled.querySelector(
      '.mobile-nav-bar button',
    ) as HTMLButtonElement;
    expect(menuButton).toBeTruthy();
    menuButton.focus();

    fixture.componentInstance.openMobileNav();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.mobileNavOpen = false;
    fixture.componentInstance.onMobileNavHide();
    await flushMicrotasks();

    expect(document.activeElement).toBe(menuButton);
  });

  it('should expose labelled navigation links in the mobile drawer', async () => {
    const fixture = TestBed.createComponent(PersonalFinanceLayout);
    fixture.componentInstance.openMobileNav();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const nav = compiled.querySelector('nav[aria-label="Primary mobile"]');
    expect(nav).toBeTruthy();
    expect(nav?.querySelectorAll('.mobile-nav-list a').length).toBe(7);
  });
});
