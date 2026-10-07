import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};

export const customerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  // Jika user sudah login tapi bukan CUSTOMER (misal: staf gudang, admin, kurir, cs),
  // arahkan ke workspace/dashboard mereka masing-masing
  if (authService.isLoggedIn() && authService.userRole() !== 'CUSTOMER') {
    authService.redirectBasedOnRole(authService.userRole());
    return false;
  }

  return true;
};

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/auth/login']);
    return false;
  }

  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  const userRole = authService.userRole();

  if (!allowedRoles || allowedRoles.length === 0 || userRole === 'SUPER_ADMIN' || allowedRoles.includes(userRole)) {
    return true;
  }

  authService.redirectBasedOnRole(userRole);
  return false;
};
