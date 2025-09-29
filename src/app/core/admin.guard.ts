import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const adminGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.role() === 'ADMIN') return true;
  return router.createUrlTree(['/admin/login']);
};
