import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card card">
        <div class="login-header">
          <span class="login-icon">🔐</span>
          <h2>Masuk ke SuperMart</h2>
          <p>Sistem Retail & Rantai Pasok Nusantara</p>
        </div>

        <!-- Quick 1-Click Role Switcher for Students & Evaluators -->
        <div class="demo-accounts-box">
          <div class="demo-title">
            <span>⚡ Uji Coba Cepat (Akun Praktikum Microservices)</span>
          </div>
          <div class="demo-grid">
            <button (click)="quickLogin('admin@nusantara.co.id')" class="demo-btn admin-btn" id="demo-admin">
              👑 Super Admin
            </button>
            <button (click)="quickLogin('gudang.jakarta@nusantara.co.id')" class="demo-btn wh-btn" id="demo-wh-jkt">
              🏭 Gudang JKT
            </button>
            <button (click)="quickLogin('gudang.denpasar@nusantara.co.id')" class="demo-btn wh-btn" id="demo-wh-dps">
              🏭 Gudang DPS
            </button>
            <button (click)="quickLogin('kurir.anto@nusantara.co.id')" class="demo-btn courier-btn" id="demo-courier">
              🚚 Kurir Anto
            </button>
            <button (click)="quickLogin('cs.agent@nusantara.co.id')" class="demo-btn cs-btn" id="demo-cs">
              🎧 CS Agent Rini
            </button>
            <button (click)="quickLogin('wayan.putra@gmail.com')" class="demo-btn cust-btn" id="demo-cust-wayan">
              👤 Wayan (Bali)
            </button>
            <button (click)="quickLogin('dewi.lestari@yahoo.com')" class="demo-btn cust-btn" id="demo-cust-dewi">
              👤 Dewi (JKT)
            </button>
            <button (click)="quickLogin('budi.santoso@gmail.com')" class="demo-btn cust-btn" id="demo-cust-budi">
              👤 Budi (BDG)
            </button>
          </div>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label class="form-label" for="email">Alamat Email</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-control"
              [(ngModel)]="email"
              placeholder="contoh: admin@nusantara.co.id"
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
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-lg submit-btn"
            id="btn-submit-login"
            [disabled]="loading()"
          >
            @if (loading()) {
              <span>Memproses...</span>
            } @else {
              <span>Masuk Sekarang →</span>
            }
          </button>
        </form>

        <div class="login-footer">
          <p>Belum memiliki akun? <a routerLink="/auth/register" id="link-register">Daftar Pelanggan Baru</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: calc(80vh - 100px);
      padding: 1.5rem;
    }
    .login-card {
      width: 100%;
      max-width: 500px;
      padding: 2.5rem;
      background: var(--bg-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
    }
    .login-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .login-icon {
      font-size: 2.5rem;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .login-header h2 {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .login-header p {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
    .demo-accounts-box {
      background: var(--bg-surface-secondary);
      border: 1px dashed #cbd5e1;
      border-radius: var(--radius-lg);
      padding: 1rem;
      margin-bottom: 1.75rem;
    }
    .demo-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
      text-align: center;
    }
    .demo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }
    .demo-btn {
      padding: 0.5rem 0.625rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
      cursor: pointer;
      background: white;
      text-align: left;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .demo-btn:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-xs);
    }
    .admin-btn:hover { border-color: #7e22ce; color: #7e22ce; background: #faf5ff; }
    .wh-btn:hover { border-color: #0284c7; color: #0284c7; background: #f0f9ff; }
    .courier-btn:hover { border-color: #d97706; color: #d97706; background: #fffbeb; }
    .cs-btn:hover { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
    .cust-btn:hover { border-color: #475569; color: #475569; background: #f8fafc; }
    .login-form {
      display: flex;
      flex-direction: column;
    }
    .submit-btn {
      width: 100%;
      margin-top: 0.5rem;
    }
    .login-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }
  `]
})
export class LoginComponent {
  auth = inject(AuthService);

  email = 'admin@nusantara.co.id';
  password = 'password123';
  loading = signal(false);

  quickLogin(email: string) {
    this.email = email;
    this.password = 'password123';
    this.onSubmit();
  }

  onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });
  }
}
