import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const redirectIfLoggedIn: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return true;
  return router.createUrlTree([auth.role() === 'ADMIN' ? '/admin' : '/dashboard']);
};
