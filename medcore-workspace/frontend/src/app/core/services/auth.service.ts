import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { User, UserProfile } from '../models/types';
import { NotificationService } from './notification.service';

interface LoginResponse {
  token: string;
  user: User;
}

interface APIResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotificationService);

  private readonly TOKEN_KEY = 'supermart_token';
  private readonly USER_KEY = 'supermart_user';

  currentUser = signal<User | null>(this.getStoredUser());
  token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  isLoggedIn = computed(() => !!this.token() && !!this.currentUser());
  userRole = computed(() => this.currentUser()?.role || 'CUSTOMER');

  constructor() {
    if (this.token()) {
      this.fetchCurrentUser().subscribe();
    }
  }

  private getStoredUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<APIResponse<LoginResponse>> {
    return this.http.post<APIResponse<LoginResponse>>('/api/v1/auth/login', { email, password }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.setSession(res.data.token, res.data.user);
          this.notify.success(`Selamat datang kembali, ${res.data.user.full_name}!`);
          this.redirectBasedOnRole(res.data.user.role || 'CUSTOMER');
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Login gagal, periksa email dan kata sandi Anda';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }

  register(data: { email: string; password: string; full_name: string; phone_number: string }): Observable<APIResponse<LoginResponse>> {
    return this.http.post<APIResponse<LoginResponse>>('/api/v1/auth/register', data).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.setSession(res.data.token, res.data.user);
          this.notify.success('Pendaftaran berhasil! Akun Anda siap digunakan.');
          this.router.navigate(['/catalog']);
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Pendaftaran gagal';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.notify.info('Anda telah keluar dari akun');
    this.router.navigate(['/auth/login']);
  }

  fetchCurrentUser(): Observable<APIResponse<{ user: User; profile: UserProfile }>> {
    return this.http.get<APIResponse<{ user: User; profile: UserProfile }>>('/api/v1/auth/me').pipe(
      tap(res => {
        if (res.success && res.data?.user) {
          this.currentUser.set(res.data.user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.data.user));
        }
      })
    );
  }

  setSession(token: string, user: User) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.currentUser.set(user);
  }

  redirectBasedOnRole(role: string) {
    switch (role) {
      case 'SUPER_ADMIN':
        this.router.navigate(['/admin']);
        break;
      case 'WAREHOUSE_STAFF':
        this.router.navigate(['/warehouse/stocks']);
        break;
      case 'COURIER':
        this.router.navigate(['/courier/deliveries']);
        break;
      case 'CS_AGENT':
        this.router.navigate(['/support-agent/tickets']);
        break;
      default:
        this.router.navigate(['/catalog']);
        break;
    }
  }
}
