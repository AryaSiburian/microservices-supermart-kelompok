import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Order, User, Stock, CustomerTicket, LowStockAlert } from '../../../core/models/types';

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container dashboard-page">
      <div class="page-header">
        <div>
          <span class="badge badge-purple" style="margin-bottom: 0.5rem;">Sistem Monolith PT Nusantara SuperMart Indonesia</span>
          <h1>Dashboard Super Administrator</h1>
          <p>Pemantauan lintas 9 domain bisnis: Transaksi, Stok, Logistik, Pengadaan, dan Layanan</p>
        </div>
        <div class="quick-admin-actions">
          <a routerLink="/admin/catalog" class="btn btn-primary btn-sm">+ Tambah Produk</a>
          <a routerLink="/admin/promotions" class="btn btn-outline btn-sm">+ Buat Voucher</a>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card card">
          <div class="kpi-icon icon-blue">📦</div>
          <div class="kpi-data">
            <span class="kpi-label">Total Pesanan</span>
            <span class="kpi-val">{{ orders().length }}</span>
            <span class="kpi-sub">Di seluruh status</span>
          </div>
        </div>

        <div class="kpi-card card">
          <div class="kpi-icon icon-green">💰</div>
          <div class="kpi-data">
            <span class="kpi-label">Volume Omset</span>
            <span class="kpi-val">Rp {{ getTotalRevenue() | number:'1.0-0' }}</span>
            <span class="kpi-sub">Total nilai transaksi</span>
          </div>
        </div>

        <div class="kpi-card card">
          <div class="kpi-icon icon-purple">👥</div>
          <div class="kpi-data">
            <span class="kpi-label">Pengguna Terdaftar</span>
            <span class="kpi-val">{{ users().length }}</span>
            <span class="kpi-sub">5 Peran Pengguna</span>
          </div>
        </div>

        <div class="kpi-card card">
          <div class="kpi-icon icon-amber">⚠️</div>
          <div class="kpi-data">
            <span class="kpi-label">Peringatan Stok Rendah</span>
            <span class="kpi-val">{{ alerts().length }}</span>
            <span class="kpi-sub">Perlu restock segera</span>
          </div>
        </div>
      </div>

      <!-- Cross Domain Overview -->
      <div class="dashboard-sections-grid">
        <!-- Recent Orders -->
        <div class="card section-card">
          <div class="section-card-header">
            <h3>Pesanan Terbaru</h3>
            <a routerLink="/orders" class="btn btn-outline btn-sm">Semua Pesanan →</a>
          </div>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>No. Pesanan</th>
                  <th>Pelanggan</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (o of orders().slice(0, 5); track o.id) {
                  <tr>
                    <td><strong>{{ o.order_number }}</strong></td>
                    <td>{{ o.customer_name }}</td>
                    <td>Rp {{ o.total_net_amount | number:'1.0-0' }}</td>
                    <td>
                      <span class="badge badge-primary">{{ o.status_name || o.status_code }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Inventory Alerts -->
        <div class="card section-card">
          <div class="section-card-header">
            <h3>Peringatan Stok Gudang</h3>
            <a routerLink="/warehouse/stocks" class="btn btn-outline btn-sm">Kelola Stok →</a>
          </div>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Gudang</th>
                  <th>Sisa Stok</th>
                  <th>Batas Minimal</th>
                </tr>
              </thead>
              <tbody>
                @for (a of alerts(); track a.id) {
                  <tr>
                    <td><strong>{{ a.product_title }}</strong></td>
                    <td>{{ a.warehouse_name }}</td>
                    <td><strong style="color: var(--color-danger)">{{ a.current_stock }} unit</strong></td>
                    <td>{{ a.threshold }} unit</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Pedagogical Teaching Box -->
      <div class="card teaching-card">
        <span class="teaching-icon">🎓</span>
        <div class="teaching-text">
          <h4>Panduan Praktikum Dekomposisi Microservices</h4>
          <p>
            Aplikasi ini sengaja dibuat sebagai <strong>Monolith modular</strong> dengan 9 domain mandiri di backend Go (<code>internal/auth</code>, <code>catalog</code>, <code>inventory</code>, <code>order</code>, <code>payment</code>, <code>promotion</code>, <code>logistics</code>, <code>procurement</code>, <code>support</code>).
            Tugas mahasiswa adalah mengidentifikasi coupling langsung (in-memory method calls antar domain) dan mengekstraknya menjadi microservice independen dengan database per service, message broker, dan REST/gRPC API.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding-bottom: 3rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .page-header h1 {
      font-size: 1.75rem;
      font-weight: 800;
    }
    .page-header p {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .quick-admin-actions {
      display: flex;
      gap: 0.5rem;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .kpi-card {
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .kpi-icon {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
    }
    .icon-blue { background: #e0f2fe; }
    .icon-green { background: #dcfce7; }
    .icon-purple { background: #f3e8ff; }
    .icon-amber { background: #fef3c7; }
    .kpi-data {
      display: flex;
      flex-direction: column;
    }
    .kpi-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0.125rem 0;
    }
    .kpi-sub {
      font-size: 0.6875rem;
      color: var(--text-secondary);
    }
    .dashboard-sections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .section-card {
      padding: 1.5rem;
    }
    .section-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .section-card-header h3 {
      font-size: 1.125rem;
      font-weight: 700;
    }
    .teaching-card {
      padding: 1.5rem;
      background: linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%);
      border: 1px solid #ddd6fe;
      display: flex;
      align-items: flex-start;
      gap: 1.25rem;
    }
    .teaching-icon {
      font-size: 2.5rem;
    }
    .teaching-text h4 {
      font-size: 1rem;
      font-weight: 800;
      color: #6b21a8;
      margin-bottom: 0.375rem;
    }
    .teaching-text p {
      font-size: 0.8125rem;
      color: #4c1d95;
      line-height: 1.6;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);

  orders = signal<Order[]>([]);
  users = signal<User[]>([]);
  alerts = signal<LowStockAlert[]>([]);

  ngOnInit() {
    this.http.get<APIResponse<Order[]>>('/api/v1/orders').subscribe(res => {
      if (res.success && res.data) this.orders.set(res.data);
    });
    this.http.get<APIResponse<User[]>>('/api/v1/auth/users').subscribe(res => {
      if (res.success && res.data) this.users.set(res.data);
    });
    this.http.get<APIResponse<LowStockAlert[]>>('/api/v1/inventory/alerts').subscribe(res => {
      if (res.success && res.data) this.alerts.set(res.data);
    });
  }

  getTotalRevenue(): number {
    return this.orders().reduce((sum, o) => sum + o.total_net_amount, 0);
  }
}
