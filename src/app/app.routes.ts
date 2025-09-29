import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { redirectIfLoggedIn } from './core/redirect-if-logged-in.guard';

export const routes: Routes = [
  // Accueil publique (landing)
  { path: '', loadComponent: () => import('./user/home/home').then(m => m.Home) },

  // Auth publique (redirige vers dashboard si déjà connecté)
  { path: 'login', canMatch: [redirectIfLoggedIn], loadComponent: () => import('./user/login/login').then(m => m.Login) },
  { path: 'register', canMatch: [redirectIfLoggedIn], loadComponent: () => import('./user/registration/registration').then(m => m.Registration) },

  // Dashboard User (protégé)
  { path: 'dashboard', canMatch: [authGuard], loadComponent: () => import('./user/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'form', canMatch: [authGuard], loadComponent: () => import('./user/form/submission-wizard/submission-wizard').then(m => m.SubmissionWizard) },

  // ===== Admin =====
  { path: 'admin/login', canMatch: [redirectIfLoggedIn], loadComponent: () => import('./admin/login/login').then(m => m.Login) },

  // Récap projet (page dédiée) — ex: /admin/recap/123
  { path: 'admin/recap/:id', canMatch: [adminGuard],
    loadComponent: () => import('./admin/recap/recap').then(m => m.SubmissionRecap)
  },

  // Tableau de bord admin (liste)
  { path: 'admin', canMatch: [adminGuard],
    loadComponent: () => import('./admin/dashboard/dashboard').then(m => m.Dashboard)
  },

  // Fallback
  { path: '**', redirectTo: '' }
];
