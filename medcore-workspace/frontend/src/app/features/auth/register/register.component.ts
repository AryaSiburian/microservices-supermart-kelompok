import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="register-wrapper">
      <div class="register-card card">
        <div class="register-header">
          <span class="register-icon">🛍️</span>
          <h2>Daftar Akun Baru</h2>
          <p>Bergabung dengan PT Nusantara SuperMart Indonesia</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-group">
            <label class="form-label" for="full_name">Nama Lengkap</label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              class="form-control"
              [(ngModel)]="fullName"
              placeholder="contoh: I Wayan Putra"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="email">Alamat Email</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-control"
              [(ngModel)]="email"
              placeholder="contoh: nama@domain.com"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="phone">Nomor Telepon / WhatsApp</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              class="form-control"
              [(ngModel)]="phoneNumber"
              placeholder="contoh: 081234567890"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Kata Sandi</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-control"
              [(ngModel)]="password"
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-lg submit-btn"
            id="btn-submit-register"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span>Mendaftarkan...</span>
            } @else {
              <span>Daftar Sekarang →</span>
            }
          </button>
        </form>

        <div class="register-footer">
          <p>Sudah punya akun? <a routerLink="/auth/login" id="link-login">Masuk ke Akun</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(80vh - 100px);
      padding: 1.5rem;
    }
    .register-card {
      width: 100%;
      max-width: 480px;
      padding: 2.5rem;
      background: var(--bg-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
    }
    .register-header {
      text-align: center;
      margin-bottom: 1.75rem;
    }
    .register-icon {
      font-size: 2.5rem;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .register-header h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .register-header p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
    .register-form {
      display: flex;
      flex-direction: column;
    }
    .submit-btn {
      width: 100%;
      margin-top: 0.5rem;
    }
    .register-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
  `]
})
export class RegisterComponent {
  auth = inject(AuthService);

  fullName = '';
  email = '';
  phoneNumber = '';
  password = '';
  loading = signal(false);

  onSubmit() {
    if (!this.email || !this.password || !this.fullName) return;
    this.loading.set(true);
    this.auth.register({
      email: this.email,
      password: this.password,
      full_name: this.fullName,
      phone_number: this.phoneNumber
    }).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });
  }
}
