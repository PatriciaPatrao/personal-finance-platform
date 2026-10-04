import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'analysis',
    loadComponent: () =>
      import('./analysis/analysis').then((m) => m.Analysis),
  },
];
