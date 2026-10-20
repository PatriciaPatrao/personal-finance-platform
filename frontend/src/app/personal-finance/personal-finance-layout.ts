import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Menubar } from 'primeng/menubar';

@Component({
  selector: 'app-personal-finance-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Menubar, Drawer, Button],
  templateUrl: './personal-finance-layout.html',
  styleUrl: './personal-finance-layout.scss',
})
export class PersonalFinanceLayout {
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
  ];

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
