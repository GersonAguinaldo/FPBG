import { Routes } from '@angular/router';

export const routes: Routes = [
  // Accueil => page d'atterrissage avec CTA
  { path: '', loadComponent: () => import('./user/home/home').then(m => m.Home) },
  // Rediriger vers login (on traitera l'accueil plus tard)
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Utilisateur
  { path: 'login', loadComponent: () => import('./user/login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./user/registration/registration').then(m => m.Registration) },
  { path: 'otp', loadComponent: () => import('./auth/otp.component').then(m => m.OtpComponent) },

  // Placeholders utiles dès maintenant (si présents dans votre code)
  { path: 'dashboard', loadComponent: () => import('./user/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'form', loadComponent: () => import('./user/form/submission-wizard/submission-wizard').then(m => m.SubmissionWizard) },

  // Fallback
  { path: '**', redirectTo: 'login' }
];
