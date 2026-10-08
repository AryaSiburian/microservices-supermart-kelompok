import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StockMutation, Warehouse, Product, ApiResponse } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-warehouse-mutations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container mutations-page">
      <div class="page-header">
        <div>
          <span class="badge badge-info">Inter-Hub Logistics</span>
          <h1 class="page-title">Mutasi & Transfer Stok Antar Gudang</h1>
          <p class="text-secondary">Distribusi dan penyeimbangan persediaan antar hub regional SuperMart.</p>
        </div>
        <div class="header-actions">
          <button (click)="openMutationModal()" class="btn btn-primary">
            ➕ Buat Mutasi Baru
          </button>
          <button (click)="loadMutations()" class="btn btn-outline" [disabled]="loading()">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Mutations Table -->
      <div class="card p-0">
        <div class="card-header p-4 border-b">
          <h3 class="font-bold text-lg">Riwayat Transfer Stok Antar Gudang</h3>
        </div>

        @if (loading()) {
          <div class="p-8 text-center">
            <div class="spinner"></div>
            <p class="mt-2 text-secondary">Memuat riwayat mutasi stok...</p>
          </div>
        } @else if (mutations().length === 0) {
          <div class="p-8 text-center text-secondary">
            <p>Belum ada riwayat mutasi stok gudang tercatat.</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Tanggal Mutasi</th>
                  <th>Produk SKU</th>
                  <th>Gudang Asal</th>
                  <th>Gudang Tujuan</th>
                  <th class="text-right">Jumlah (Unit)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (m of mutations(); track m.id) {
                  <tr>
                    <td class="text-secondary text-sm">
                      {{ m.mutation_date | date:'dd MMM yyyy, HH:mm' }}
                    </td>
                    <td>
                      <span class="font-semibold">{{ m.product_title || 'ID: ' + m.product_id }}</span>
                    </td>
                    <td>
                      <span class="warehouse-tag origin">
                        📤 {{ m.source_warehouse_name || m.source_warehouse_id }}
                      </span>
                    </td>
                    <td>
                      <span class="warehouse-tag dest">
                        📥 {{ m.destination_warehouse_name || m.destination_warehouse_id }}
                      </span>
                    </td>
                    <td class="text-right font-bold text-primary">
                      {{ m.quantity }} pcs
                    </td>
                    <td>
                      <span class="badge badge-success">COMPLETED</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- New Mutation Modal -->
      @if (showModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Buat Mutasi Stok Antar Gudang</h3>
              <button (click)="closeMutationModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <form (ngSubmit)="submitMutation()">
                <div class="form-group mb-4">
                  <label class="form-label">Pilih Produk *</label>
                  <select [(ngModel)]="newMutation.product_id" name="product_id" class="form-control" required>
                    <option value="">-- Pilih Produk yang Ditransfer --</option>
                    @for (p of products(); track p.id) {
                      <option [value]="p.id">{{ p.title }} ({{ p.sku }})</option>
                    }
                  </select>
                </div>

                <div class="grid grid-2 gap-4 mb-4">
                  <div class="form-group">
                    <label class="form-label">Gudang Asal (Source) *</label>
                    <select [(ngModel)]="newMutation.source_warehouse_id" name="source_warehouse_id" class="form-control" required>
                      <option value="">-- Dari Gudang --</option>
                      @for (w of warehouses(); track w.id) {
                        <option [value]="w.id">{{ w.warehouse_name }} ({{ w.city }})</option>
                      }
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Gudang Tujuan (Destination) *</label>
                    <select [(ngModel)]="newMutation.destination_warehouse_id" name="destination_warehouse_id" class="form-control" required>
                      <option value="">-- Ke Gudang --</option>
                      @for (w of warehouses(); track w.id) {
                        <option [value]="w.id">{{ w.warehouse_name }} ({{ w.city }})</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="form-group mb-4">
                  <label class="form-label">Kuantitas Transfer (Unit) *</label>
                  <input 
                    type="number" 
                    [(ngModel)]="newMutation.quantity" 
                    name="quantity"
                    min="1" 
                    class="form-control" 
                    placeholder="Contoh: 50"
                    required
                  />
                </div>

                <div class="modal-footer">
                  <button type="button" (click)="closeMutationModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
                  <button type="submit" class="btn btn-primary" [disabled]="submitting() || !isFormValid()">
                    @if (submitting()) { Mengirim... } @else { Eksekusi Transfer }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .mutations-page {
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
      gap: 0.75rem;
    }
    .warehouse-tag {
      font-size: 0.8125rem;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
      font-weight: 500;
    }
    .warehouse-tag.origin {
      background: #fee2e2;
      color: #991b1b;
    }
    .warehouse-tag.dest {
      background: #dcfce7;
      color: #166534;
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
      max-width: 540px;
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
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `]
})
export class MutationsComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  mutations = signal<StockMutation[]>([]);
  warehouses = signal<Warehouse[]>([]);
  products = signal<Product[]>([]);

  loading = signal(true);
  submitting = signal(false);
  showModal = signal(false);

  newMutation = {
    product_id: '',
    source_warehouse_id: '',
    destination_warehouse_id: '',
    quantity: 1
  };

  ngOnInit() {
    this.loadMutations();
    this.loadWarehouses();
    this.loadProducts();
  }

  loadMutations() {
    this.loading.set(true);
    this.http.get<ApiResponse<StockMutation[]>>('/api/v1/inventory/mutations')
      .subscribe({
        next: (res) => {
          this.mutations.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat log mutasi stok');
          this.loading.set(false);
        }
      });
  }

  loadWarehouses() {
    this.http.get<ApiResponse<Warehouse[]>>('/api/v1/inventory/warehouses')
      .subscribe({
        next: (res) => {
          if (res.data) this.warehouses.set(res.data);
        }
      });
  }

  loadProducts() {
    this.http.get<ApiResponse<Product[]>>('/api/v1/catalog/products?limit=50')
      .subscribe({
        next: (res) => {
          if (res.data) this.products.set(res.data);
        }
      });
  }

  openMutationModal() {
    this.newMutation = {
      product_id: '',
      source_warehouse_id: '',
      destination_warehouse_id: '',
      quantity: 10
    };
    this.showModal.set(true);
  }

  closeMutationModal() {
    this.showModal.set(false);
  }

  isFormValid(): boolean {
    return (
      !!this.newMutation.product_id &&
      !!this.newMutation.source_warehouse_id &&
      !!this.newMutation.destination_warehouse_id &&
      this.newMutation.source_warehouse_id !== this.newMutation.destination_warehouse_id &&
      this.newMutation.quantity > 0
    );
  }

  submitMutation() {
    if (this.newMutation.source_warehouse_id === this.newMutation.destination_warehouse_id) {
      this.notify.error('Gudang asal dan gudang tujuan tidak boleh sama');
      return;
    }

    this.submitting.set(true);
    this.http.post<ApiResponse<any>>('/api/v1/inventory/mutations', {
      product_id: this.newMutation.product_id,
      source_warehouse_id: this.newMutation.source_warehouse_id,
      destination_warehouse_id: this.newMutation.destination_warehouse_id,
      quantity: Number(this.newMutation.quantity)
    }).subscribe({
      next: (res) => {
        this.notify.success('Mutasi stok antar gudang berhasil dieksekusi!');
        this.closeMutationModal();
        this.submitting.set(false);
        this.loadMutations();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal memproses mutasi stok');
        this.submitting.set(false);
      }
    });
  }
}
