import { Routes } from '@angular/router';
import { authGuardFn } from '@auth0/auth0-angular';

import { pageTitle } from './app-page-titles';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'personal_finance',
    pathMatch: 'full',
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./auth/callback').then((m) => m.AuthCallback),
  },
  {
    path: 'sign-in',
    title: pageTitle('Sign in'),
    loadComponent: () =>
      import('./auth/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'personal_finance',
    canActivate: [authGuardFn],
    loadComponent: () =>
      import('./personal-finance/personal-finance-layout').then(
        (m) => m.PersonalFinanceLayout,
      ),
    children: [
      {
        path: '',
        title: pageTitle('Dashboard'),
        loadComponent: () =>
          import('./personal-finance/personal-finance').then(
            (m) => m.PersonalFinance,
          ),
      },
      {
        path: 'accounts',
        title: pageTitle('Accounts'),
        loadComponent: () =>
          import('./accounts/accounts').then((m) => m.Accounts),
      },
      {
        path: 'accounts/:id',
        title: pageTitle('Account'),
        loadComponent: () =>
          import('./accounts/account-detail').then((m) => m.AccountDetail),
      },
      {
        path: 'schedules',
        title: pageTitle('Schedules'),
        loadComponent: () =>
          import('./schedules/schedules').then((m) => m.Schedules),
      },
      {
        path: 'goals',
        title: pageTitle('Goals'),
        loadComponent: () =>
          import('./goals/goals').then((m) => m.Goals),
      },
      {
        path: 'analysis',
        title: pageTitle('Analysis'),
        loadComponent: () =>
          import('./analysis/analysis').then((m) => m.Analysis),
      },
      {
        path: 'forecast',
        title: pageTitle('Forecast'),
        loadComponent: () =>
          import('./forecast/forecast').then((m) => m.Forecast),
      },
      {
        path: 'transactions',
        title: pageTitle('Transactions'),
        loadComponent: () =>
          import('./transactions/transactions').then((m) => m.Transactions),
      },
    ],
  },
];
