import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'personal_finance',
    pathMatch: 'full',
  },
  {
    path: 'personal_finance',
    loadComponent: () =>
      import('./personal-finance/personal-finance-layout').then(
        (m) => m.PersonalFinanceLayout,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./personal-finance/personal-finance').then(
            (m) => m.PersonalFinance,
          ),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./accounts/accounts').then((m) => m.Accounts),
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('./accounts/account-detail').then((m) => m.AccountDetail),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./goals/goals').then((m) => m.Goals),
      },
      {
        path: 'analysis',
        loadComponent: () =>
          import('./analysis/analysis').then((m) => m.Analysis),
      },
      {
        path: 'forecast',
        loadComponent: () =>
          import('./forecast/forecast').then((m) => m.Forecast),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./transactions/transactions').then((m) => m.Transactions),
      },
    ],
  },
];
