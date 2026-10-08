import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-layout">
      <!-- Top Navigation Bar -->
      <header class="navbar">
        <div class="nav-container">
          <div class="nav-brand">
            <a routerLink="/" class="logo-link">
              <span class="logo-icon">🏪</span>
              <div class="logo-text">
                <span class="brand-title">Nusantara</span>
                <span class="brand-sub">SuperMart</span>
              </div>
            </a>
            <span class="monolith-badge" title="Course Seed Monolith Backend">Monolith Seed v1.0</span>
          </div>

          <!-- Role-Aware Navigation Links -->
          <nav class="nav-links">
            <!-- Belanja (Hanya untuk Tamu / Pelanggan) -->
            @if (!auth.isLoggedIn() || auth.userRole() === 'CUSTOMER') {
              <a routerLink="/catalog" routerLinkActive="active" class="nav-item">
                <span>🛍️ Belanja</span>
              </a>
            }

            @if (auth.isLoggedIn()) {
              <!-- Customer Links (Khusus Pelanggan) -->
              @if (auth.userRole() === 'CUSTOMER') {
                <a routerLink="/orders" routerLinkActive="active" class="nav-item">
                  <span>📦 Pesanan Saya</span>
                </a>
                <a routerLink="/wallet" routerLinkActive="active" class="nav-item">
                  <span>👛 Saldo Dompet</span>
                </a>
                <a routerLink="/support" routerLinkActive="active" class="nav-item">
                  <span>🎧 Bantuan & Tiket</span>
                </a>
              }

              <!-- Warehouse Staff Links -->
              @if (auth.userRole() === 'WAREHOUSE_STAFF' || auth.userRole() === 'SUPER_ADMIN') {
                <div class="nav-divider"></div>
                <a routerLink="/warehouse/stocks" routerLinkActive="active" class="nav-item ops-item">
                  <span>🏭 Stok Gudang</span>
                </a>
                <a routerLink="/warehouse/mutations" routerLinkActive="active" class="nav-item ops-item">
                  <span>🔄 Mutasi</span>
                </a>
                <a routerLink="/warehouse/procurement" routerLinkActive="active" class="nav-item ops-item">
                  <span>📥 Penerimaan GRN</span>
                </a>
              }

              <!-- Courier Links -->
              @if (auth.userRole() === 'COURIER' || auth.userRole() === 'SUPER_ADMIN') {
                <div class="nav-divider"></div>
                <a routerLink="/courier/deliveries" routerLinkActive="active" class="nav-item ops-item">
                  <span>🚚 Pengantaran & POD</span>
                </a>
              }

              <!-- CS Agent Links -->
              @if (auth.userRole() === 'CS_AGENT' || auth.userRole() === 'SUPER_ADMIN') {
                <div class="nav-divider"></div>
                <a routerLink="/support-agent/tickets" routerLinkActive="active" class="nav-item ops-item">
                  <span>💬 Antrean CS</span>
                </a>
              }

              <!-- Super Admin Links -->
              @if (auth.userRole() === 'SUPER_ADMIN') {
                <div class="nav-divider"></div>
                <a routerLink="/admin" routerLinkActive="active" class="nav-item admin-item">
                  <span>⚙️ Dashboard Admin</span>
                </a>
                <a routerLink="/admin/users" routerLinkActive="active" class="nav-item admin-item">
                  <span>👥 Pengguna</span>
                </a>
                <a routerLink="/admin/catalog" routerLinkActive="active" class="nav-item admin-item">
                  <span>🏷️ Kelola Katalog</span>
                </a>
                <a routerLink="/admin/promotions" routerLinkActive="active" class="nav-item admin-item">
                  <span>🎉 Promosi & Voucher</span>
                </a>
              }
            }
          </nav>

          <!-- Right Navigation: Cart, User Badge, Auth Action -->
          <div class="nav-actions">
            <!-- Cart Button (Hanya Tamu atau Pelanggan) -->
            @if (!auth.isLoggedIn() || auth.userRole() === 'CUSTOMER') {
              <a routerLink="/cart" class="cart-btn" id="nav-cart-btn" title="Keranjang Belanja">
                <span class="cart-icon">🛒</span>
                @if (cart.itemCount() > 0) {
                  <span class="cart-counter">{{ cart.itemCount() }}</span>
                }
              </a>
            }

            @if (auth.isLoggedIn()) {
              <div class="user-pill">
                <span class="user-role-badge" [ngClass]="'role-' + auth.userRole().toLowerCase()">
                  {{ auth.userRole() }}
                </span>
                <span class="user-name">{{ auth.currentUser()?.full_name }}</span>
                <button (click)="auth.logout()" class="btn-logout" id="btn-logout" title="Keluar">
                  🚪 Keluar
                </button>
              </div>
            } @else {
              <div class="auth-buttons">
                <a routerLink="/auth/login" class="btn btn-primary btn-sm" id="btn-login-nav">Masuk</a>
                <a routerLink="/auth/register" class="btn btn-outline btn-sm" id="btn-register-nav">Daftar</a>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- Main Content Outlet -->
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <!-- Toast Notifications -->
      <div class="toast-container">
        @for (toast of notify.toasts(); track toast.id) {
          <div class="toast toast-{{ toast.type }}" (click)="notify.remove(toast.id)">
            <span>{{ toast.message }}</span>
          </div>
        }
      </div>

      <!-- Footer -->
      <footer class="footer">
        <div class="container footer-content">
          <p>© 2026 PT Nusantara SuperMart Indonesia. Course Seed Monolith for Microservices Architecture Decomposition.</p>
          <div class="footer-links">
            <span>MySQL 8.0 • 120 Tables</span>
            <span>Go Fiber v3 Monolith Backend</span>
            <span>Angular 22 SPA Frontend</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .app-layout {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .navbar {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: var(--shadow-xs);
    }
    .nav-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }
    .logo-icon {
      font-size: 1.75rem;
    }
    .logo-text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .brand-title {
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--color-primary-dark);
      letter-spacing: -0.02em;
    }
    .brand-sub {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .monolith-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      background: #f1f5f9;
      color: #64748b;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid #cbd5e1;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      overflow-x: auto;
      padding: 0.25rem 0;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-secondary);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      white-space: nowrap;
    }
    .nav-item:hover {
      background: var(--bg-surface-secondary);
      color: var(--text-primary);
    }
    .nav-item.active {
      background: var(--color-primary-light);
      color: var(--color-primary-dark);
    }
    .ops-item.active {
      background: #ecfdf5;
      color: #065f46;
    }
    .admin-item.active {
      background: #f3e8ff;
      color: #6b21a8;
    }
    .nav-divider {
      width: 1px;
      height: 20px;
      background: var(--border-color);
      margin: 0 0.25rem;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .cart-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--bg-surface-secondary);
      border: 1px solid var(--border-color);
      text-decoration: none;
      transition: all var(--transition-fast);
    }
    .cart-btn:hover {
      background: var(--color-primary-light);
      border-color: var(--color-primary);
    }
    .cart-icon {
      font-size: 1.25rem;
    }
    .cart-counter {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--color-danger);
      color: white;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-full);
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: var(--bg-surface-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
    }
    .user-role-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-full);
    }
    .role-super_admin { background: #f3e8ff; color: #7e22ce; }
    .role-warehouse_staff { background: #e0f2fe; color: #0369a1; }
    .role-courier { background: #fef3c7; color: #b45309; }
    .role-cs_agent { background: #dcfce7; color: #15803d; }
    .role-customer { background: #e2e8f0; color: #334155; }
    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .btn-logout {
      background: transparent;
      border: none;
      font-size: 0.75rem;
      color: var(--color-danger);
      cursor: pointer;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
    }
    .btn-logout:hover {
      background: var(--color-danger-light);
    }
    .auth-buttons {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .main-content {
      flex: 1;
      padding: 2rem 0;
    }
    .footer {
      background: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      padding: 1.5rem 0;
      margin-top: auto;
    }
    .footer-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      text-align: center;
    }
    .footer-links {
      display: flex;
      gap: 1.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  auth = inject(AuthService);
  cart = inject(CartService);
  notify = inject(NotificationService);

  ngOnInit() {
    if (this.auth.isLoggedIn() && this.auth.userRole() === 'CUSTOMER') {
      this.cart.loadCart().subscribe();
    }
  }
}

