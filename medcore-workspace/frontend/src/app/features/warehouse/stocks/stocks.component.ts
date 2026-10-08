import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Stock, Warehouse, LowStockAlert, ApiResponse } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-warehouse-stocks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container stocks-page">
      <div class="page-header">
        <div>
          <span class="badge badge-info">Warehouse Operations</span>
          <h1 class="page-title">Manajemen Stok & Gudang</h1>
          <p class="text-secondary">Pantau inventaris fisik di seluruh hub regional Nusantara SuperMart.</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedWarehouseId" (change)="loadStocks()" class="form-control warehouse-select">
            <option value="">Semua Gudang</option>
            @for (w of warehouses(); track w.id) {
              <option [value]="w.id">{{ w.warehouse_name }} ({{ w.city }})</option>
            }
          </select>
          <button (click)="loadAllData()" class="btn btn-outline" [disabled]="loading()">
            🔄 Muat Ulang
          </button>
        </div>
      </div>

      <!-- Overview Metric Cards -->
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon bg-primary-subtle">📦</div>
          <div class="stat-content">
            <span class="stat-label">Total Item SKU</span>
            <span class="stat-value">{{ stocks().length }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-success-subtle">✅</div>
          <div class="stat-content">
            <span class="stat-label">Stok Tersedia (On Hand)</span>
            <span class="stat-value">{{ totalOnHand() }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-warning-subtle">🔒</div>
          <div class="stat-content">
            <span class="stat-label">Stok Dipesan (Reserved)</span>
            <span class="stat-value">{{ totalReserved() }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-danger-subtle">⚠️</div>
          <div class="stat-content">
            <span class="stat-label">Peringatan Menipis</span>
            <span class="stat-value text-danger">{{ alerts().length }}</span>
          </div>
        </div>
      </div>

      <!-- Low Stock Alerts Banner if any -->
      @if (alerts().length > 0) {
        <div class="alert alert-warning mb-6">
          <div class="alert-header">
            <strong>⚠️ Perhatian: Terdapat {{ alerts().length }} produk dengan stok di bawah batas minimum (Threshold)!</strong>
          </div>
          <div class="alert-items">
            @for (alert of alerts(); track alert.id) {
              <span class="alert-chip">
                {{ alert.product_title || 'SKU ' + alert.product_id }}: <strong>{{ alert.current_stock }}</strong> / min {{ alert.threshold }} ({{ alert.warehouse_name }})
              </span>
            }
          </div>
        </div>
      }

      <!-- Stock Table Card -->
      <div class="card p-0">
        <div class="table-toolbar p-4 border-b">
          <div class="search-input-wrapper">
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Cari SKU atau nama produk..." 
              class="form-control"
            />
          </div>
          <div class="text-sm text-secondary">
            Menampilkan {{ filteredStocks().length }} dari {{ stocks().length }} data inventaris
          </div>
        </div>

        @if (loading()) {
          <div class="loading-state p-8 text-center">
            <div class="spinner"></div>
            <p class="mt-2 text-secondary">Memuat data inventaris gudang...</p>
          </div>
        } @else if (filteredStocks().length === 0) {
          <div class="empty-state p-8 text-center">
            <p class="text-secondary">Tidak ada inventaris yang cocok dengan filter yang dipilih.</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Produk / SKU</th>
                  <th>Gudang</th>
                  <th class="text-right">On Hand</th>
                  <th class="text-right">Reserved</th>
                  <th class="text-right">Available</th>
                  <th>Status</th>
                  <th class="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredStocks(); track item.id) {
                  <tr>
                    <td>
                      <div class="product-cell">
                        <span class="product-name font-semibold">{{ item.product_title }}</span>
                        <span class="product-sku text-secondary font-mono">{{ item.product_sku }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="warehouse-badge">
                        🏭 {{ item.warehouse_name }} ({{ item.warehouse_city }})
                      </span>
                    </td>
                    <td class="text-right font-semibold">{{ item.quantity_on_hand }}</td>
                    <td class="text-right text-warning font-semibold">{{ item.quantity_reserved }}</td>
                    <td class="text-right font-bold text-success">
                      {{ item.quantity_on_hand - item.quantity_reserved }}
                    </td>
                    <td>
                      @if (item.quantity_on_hand <= 5) {
                        <span class="badge badge-danger">Kritis</span>
                      } @else if (item.quantity_on_hand <= 15) {
                        <span class="badge badge-warning">Menipis</span>
                      } @else {
                        <span class="badge badge-success">Aman</span>
                      }
                    </td>
                    <td class="text-right">
                      <button 
                        (click)="openAdjustModal(item)" 
                        class="btn btn-outline btn-sm"
                        title="Penyesuaian Stok Fisik"
                      >
                        ✏️ Adjust
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Stock Adjust Modal -->
      @if (selectedStock()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Penyesuaian Stok Fisik (Stock Opname)</h3>
              <button (click)="closeAdjustModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <p class="text-secondary mb-4">
                Ubah jumlah stok fisik di <strong>{{ selectedStock()?.warehouse_name }}</strong> untuk SKU <strong>{{ selectedStock()?.product_sku }}</strong>.
              </p>

              <div class="form-group mb-4">
                <label class="form-label">Produk</label>
                <input type="text" [value]="selectedStock()?.product_title" disabled class="form-control" />
              </div>

              <div class="grid grid-2 gap-4 mb-4">
                <div class="form-group">
                  <label class="form-label">Stok Saat Ini (On Hand)</label>
                  <input type="number" [value]="selectedStock()?.quantity_on_hand" disabled class="form-control" />
                </div>
                <div class="form-group">
                  <label class="form-label">Stok Baru Aktual *</label>
                  <input 
                    type="number" 
                    [(ngModel)]="adjustQuantity" 
                    min="0"
                    class="form-control" 
                    placeholder="Contoh: 150"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Catatan Alasan</label>
                <input 
                  type="text" 
                  [(ngModel)]="adjustReason" 
                  placeholder="Misal: Hasil opname fisik berkala rak A3"
                  class="form-control"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="closeAdjustModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
              <button (click)="submitAdjustment()" class="btn btn-primary" [disabled]="submitting()">
                @if (submitting()) { Memproses... } @else { Simpan Penyesuaian }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .stocks-page {
      padding-bottom: 3rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;
    }
    .page-title {
      font-size: 1.875rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0.5rem 0 0.25rem;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .warehouse-select {
      min-width: 220px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
    }
    .stat-icon {
      width: 50px;
      height: 50px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    .bg-primary-subtle { background: #e0e7ff; }
    .bg-success-subtle { background: #dcfce7; }
    .bg-warning-subtle { background: #fef3c7; }
    .bg-danger-subtle { background: #fee2e2; }
    .stat-content {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .alert-items {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .alert-chip {
      background: white;
      border: 1px solid #fde047;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
    }
    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .search-input-wrapper {
      max-width: 320px;
      width: 100%;
    }
    .product-cell {
      display: flex;
      flex-direction: column;
    }
    .product-name {
      color: var(--text-primary);
    }
    .product-sku {
      font-size: 0.75rem;
    }
    .warehouse-badge {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1rem;
    }
    .modal-card {
      background: var(--bg-surface);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 500px;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
    }
    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--text-muted);
    }
    .modal-body {
      padding: 1.5rem;
    }
    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color);
      background: var(--bg-surface-secondary);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `]
})
export class StocksComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  stocks = signal<Stock[]>([]);
  warehouses = signal<Warehouse[]>([]);
  alerts = signal<LowStockAlert[]>([]);
  
  loading = signal(true);
  submitting = signal(false);

  selectedWarehouseId = '';
  searchQuery = '';

  selectedStock = signal<Stock | null>(null);
  adjustQuantity = 0;
  adjustReason = '';

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.loadWarehouses();
    this.loadAlerts();
    this.loadStocks();
  }

  loadWarehouses() {
    this.http.get<ApiResponse<Warehouse[]>>('/api/v1/inventory/warehouses')
      .subscribe({
        next: (res) => {
          if (res.data) this.warehouses.set(res.data);
        },
        error: (err) => console.error('Failed to load warehouses', err)
      });
  }

  loadAlerts() {
    this.http.get<ApiResponse<LowStockAlert[]>>('/api/v1/inventory/alerts')
      .subscribe({
        next: (res) => {
          if (res.data) this.alerts.set(res.data);
        },
        error: (err) => console.error('Failed to load alerts', err)
      });
  }

  loadStocks() {
    let url = '/api/v1/inventory/stocks';
    if (this.selectedWarehouseId) {
      url += `?warehouse_id=${this.selectedWarehouseId}`;
    }

    this.http.get<ApiResponse<Stock[]>>(url)
      .subscribe({
        next: (res) => {
          this.stocks.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat data stok inventaris');
          this.loading.set(false);
        }
      });
  }

  filteredStocks() {
    let list = this.stocks();
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.product_title && s.product_title.toLowerCase().includes(q)) ||
        (s.product_sku && s.product_sku.toLowerCase().includes(q))
      );
    }
    return list;
  }

  totalOnHand(): number {
    return this.stocks().reduce((acc, s) => acc + (s.quantity_on_hand || 0), 0);
  }

  totalReserved(): number {
    return this.stocks().reduce((acc, s) => acc + (s.quantity_reserved || 0), 0);
  }

  openAdjustModal(stock: Stock) {
    this.selectedStock.set(stock);
    this.adjustQuantity = stock.quantity_on_hand;
    this.adjustReason = '';
  }

  closeAdjustModal() {
    this.selectedStock.set(null);
  }

  submitAdjustment() {
    const stock = this.selectedStock();
    if (!stock) return;

    if (this.adjustQuantity < 0) {
      this.notify.error('Jumlah stok fisik tidak boleh negatif');
      return;
    }

    this.submitting.set(true);
    this.http.put<ApiResponse<any>>(`/api/v1/inventory/stocks/${stock.id}/adjust`, {
      quantity_on_hand: Number(this.adjustQuantity)
    }).subscribe({
      next: (res) => {
        this.notify.success(`Stok ${stock.product_sku} berhasil diperbarui menjadi ${this.adjustQuantity}`);
        this.closeAdjustModal();
        this.submitting.set(false);
        this.loadStocks();
        this.loadAlerts();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal mengubah stok');
        this.submitting.set(false);
      }
    });
  }
}
