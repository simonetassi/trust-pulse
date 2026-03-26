import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
  },
  {
    path: 'device/:deviceId',
    loadComponent: () => import('./pages/device-detail/device-detail').then(m => m.DeviceDetailComponent),
  },
  {
    path: 'operator',
    loadComponent: () => import('./pages/operator/operator').then(m => m.OperatorComponent),
  }
];
