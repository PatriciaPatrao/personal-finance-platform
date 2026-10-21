import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Menubar } from 'primeng/menubar';

@Component({
  selector: 'app-personal-finance-layout',
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Menubar,
    Drawer,
    Button,
  ],
  templateUrl: './personal-finance-layout.html',
  styleUrl: './personal-finance-layout.scss',
})
export class PersonalFinanceLayout {
  private readonly auth = inject(AuthService);

  readonly isAuthenticated$ = this.auth.isAuthenticated$;

  @ViewChild('mobileNavTrigger', { read: ElementRef })
  private mobileNavTriggerRef?: ElementRef<HTMLElement>;

  mobileNavOpen = false;

  readonly navItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      routerLink: '/personal_finance',
      routerLinkActiveOptions: { exact: true },
    },
    {
      label: 'Transactions',
      icon: 'pi pi-list',
      routerLink: '/personal_finance/transactions',
    },
    {
      label: 'Accounts',
      icon: 'pi pi-wallet',
      routerLink: '/personal_finance/accounts',
    },
    {
      label: 'Schedules',
      icon: 'pi pi-calendar',
      routerLink: '/personal_finance/schedules',
    },
    {
      label: 'Forecast',
      icon: 'pi pi-chart-line',
      routerLink: '/personal_finance/forecast',
    },
    {
      label: 'Analysis',
      icon: 'pi pi-chart-bar',
      routerLink: '/personal_finance/analysis',
    },
    {
      label: 'Goals',
      icon: 'pi pi-flag',
      routerLink: '/personal_finance/goals',
    },
    {
      label: 'Household',
      icon: 'pi pi-users',
      routerLink: '/personal_finance/household',
    },
  ];

  signOut(): void {
    void this.auth.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  openMobileNav(): void {
    this.mobileNavOpen = true;
  }

  onMobileNavHide(): void {
    queueMicrotask(() => this.focusMobileNavTrigger());
  }

  private focusMobileNavTrigger(): void {
    const host = this.mobileNavTriggerRef?.nativeElement;
    const button = host?.querySelector('button');
    if (button instanceof HTMLButtonElement) {
      button.focus();
    }
  }

  skipToMain(): void {
    const main = document.getElementById('main-content');
    if (!main) {
      return;
    }

    queueMicrotask(() => {
      main.focus({ preventScroll: false });
    });
  }

  onSkipKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.skipToMain();
  }
}
