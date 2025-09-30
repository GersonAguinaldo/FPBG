import { Routes } from '@angular/router';
import {authGuard} from './core/auth.guard';

export const routes: Routes = [
  // Accueil => page d'atterrissage avec CTA
  { path: '', loadComponent: () => import('./user/home/home').then(m => m.Home) },
  // Rediriger vers login (on traitera l'accueil plus tard)
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Utilisateur
  { path: 'login', loadComponent: () => import('./user/login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./user/registration/registration').then(m => m.Registration) },


  { path: 'dashboard',canActivate: [authGuard], loadComponent: () => import('./user/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'form',canActivate: [authGuard], loadComponent: () => import('./user/form/submission-wizard/submission-wizard').then(m => m.SubmissionWizard) },
  {
    path: 'recap',
    loadComponent: () => import('./user/form/recap/recap').then(c => c.SubmissionRecap),
    // canActivate: [authGuard], // si vous voulez protéger
  },

  {
    path: 'otp',
    loadComponent: () => import('./auth/otp.component').then(m => m.OtpComponent)
  },

  // Fallback
  { path: '**', redirectTo: 'login' }

];
