import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PurchaseOrder, PurchaseOrderItem, GoodsReceiptNote, ApiResponse, Product } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-warehouse-procurement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container procurement-page">
      <div class="page-header">
        <div>
          <span class="badge badge-info">Supply Chain Inbound</span>
          <h1 class="page-title">Penerimaan Barang (GRN) & Pengadaan (PO)</h1>
          <p class="text-secondary">Verifikasi barang masuk dari pemasok dan pembaharuan otomatis stok inventaris gudang.</p>
        </div>
        <div class="header-actions">
          <button (click)="loadAllData()" class="btn btn-outline" [disabled]="loading()">
            🔄 Muat Ulang
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs mb-6">
        <button 
          (click)="activeTab = 'po'" 
          class="tab-btn" 
          [class.active]="activeTab === 'po'"
        >
          📋 Purchase Orders ({{ purchaseOrders().length }})
        </button>
        <button 
          (click)="activeTab = 'grn'" 
          class="tab-btn" 
          [class.active]="activeTab === 'grn'"
        >
          📥 Goods Receipt Notes (GRN) ({{ grns().length }})
        </button>
      </div>

      <!-- TAB 1: PURCHASE ORDERS -->
      @if (activeTab === 'po') {
        <div class="card p-0">
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="font-bold text-lg">Daftar Purchase Order Masuk</h3>
            <span class="text-sm text-secondary">Klik "Terima GRN" untuk memasukkan barang ke stok gudang</span>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat data Purchase Order...</p>
            </div>
          } @else if (purchaseOrders().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Belum ada Purchase Order yang terdaftar.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>No. PO</th>
                    <th>Supplier</th>
                    <th>Gudang Tujuan</th>
                    <th>Tanggal PO</th>
                    <th class="text-right">Total Nilai</th>
                    <th>Status</th>
                    <th class="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (po of purchaseOrders(); track po.id) {
                    <tr>
                      <td class="font-mono font-bold">{{ po.po_number }}</td>
                      <td>
                        <span class="font-semibold">{{ po.supplier_name || po.supplier_id }}</span>
                      </td>
                      <td>
                        <span class="badge badge-info">🏭 {{ po.warehouse_name || po.warehouse_id }}</span>
                      </td>
                      <td class="text-secondary text-sm">
                        {{ po.po_date | date:'dd MMM yyyy' }}
                      </td>
                      <td class="text-right font-bold text-primary">
                        Rp {{ po.total_po_amount | number:'1.0-0' }}
                      </td>
                      <td>
                        @switch (po.status) {
                          @case ('APPROVED') { <span class="badge badge-success">APPROVED</span> }
                          @case ('RECEIVED') { <span class="badge badge-info">RECEIVED (GRN)</span> }
                          @case ('COMPLETED') { <span class="badge badge-success">COMPLETED</span> }
                          @default { <span class="badge badge-warning">{{ po.status }}</span> }
                        }
                      </td>
                      <td class="text-right">
                        @if (po.status === 'PENDING') {
                          <button (click)="approvePO(po.id)" class="btn btn-outline btn-sm mr-2">
                            Setujui
                          </button>
                          <button (click)="openReceiveModal(po)" class="btn btn-primary btn-sm">
                            📥 Terima GRN
                          </button>
                        }
                        @if (po.status === 'APPROVED') {
                          <button (click)="openReceiveModal(po)" class="btn btn-primary btn-sm">
                            📥 Terima GRN
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- TAB 2: GOODS RECEIPT NOTES (GRN) -->
      @if (activeTab === 'grn') {
        <div class="card p-0">
          <div class="p-4 border-b">
            <h3 class="font-bold text-lg">Riwayat Penerimaan Barang Fisik (GRN)</h3>
            <p class="text-sm text-secondary">Setiap pencatatan GRN secara otomatis menambah stok on-hand di inventaris gudang.</p>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat data GRN...</p>
            </div>
          } @else if (grns().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Belum ada tanda penerimaan barang tercatat.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>No. GRN</th>
                    <th>Ref PO</th>
                    <th>Penerima</th>
                    <th>Tanggal Terima</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (grn of grns(); track grn.id) {
                    <tr>
                      <td class="font-mono font-bold text-primary">{{ grn.grn_number }}</td>
                      <td class="font-mono">{{ grn.po_number || grn.purchase_order_id }}</td>
                      <td>{{ grn.receiver_name || 'Staff Gudang' }}</td>
                      <td class="text-secondary text-sm">
                        {{ grn.receipt_date | date:'dd MMM yyyy, HH:mm' }}
                      </td>
                      <td>
                        <span class="badge badge-success">TERVERIFIKASI & STOK BERTAMBAH</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- Receive Goods Modal -->
      @if (selectedPO()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Catat Penerimaan Barang (GRN)</h3>
              <button (click)="closeReceiveModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <p class="text-secondary mb-4">
                Penerimaan untuk <strong>{{ selectedPO()?.po_number }}</strong> ke <strong>{{ selectedPO()?.warehouse_name }}</strong>.
              </p>

              <div class="form-group mb-4">
                <label class="form-label">Pilih Produk Yang Diterima *</label>
                <select [(ngModel)]="receiveForm.product_id" class="form-control">
                  <option value="">-- Pilih Produk --</option>
                  @for (p of products(); track p.id) {
                    <option [value]="p.id">{{ p.title }} ({{ p.sku }})</option>
                  }
                </select>
              </div>

              <div class="form-group mb-4">
                <label class="form-label">Kuantitas Fisik Diterima *</label>
                <input 
                  type="number" 
                  [(ngModel)]="receiveForm.received_qty" 
                  min="1" 
                  class="form-control" 
                  placeholder="Contoh: 100" 
                />
              </div>

              <div class="form-group">
                <label class="form-label">Catatan Kondisi Barang</label>
                <input 
                  type="text" 
                  [(ngModel)]="receiveForm.notes" 
                  class="form-control" 
                  placeholder="Kondisi kemasan utuh, lolos QC warehouse" 
                />
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="closeReceiveModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
              <button 
                (click)="submitGRN()" 
                class="btn btn-primary" 
                [disabled]="submitting() || !receiveForm.product_id || receiveForm.received_qty <= 0"
              >
                @if (submitting()) { Menyimpan & Menambah Stok... } @else { Konfirmasi Penerimaan }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .procurement-page {
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
    .tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }
    .tab-btn {
      padding: 0.75rem 1.25rem;
      font-weight: 700;
      font-size: 0.875rem;
      border: none;
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      transition: all var(--transition-fast);
    }
    .tab-btn.active {
      color: var(--color-primary-dark);
      background: var(--bg-surface-secondary);
      border-bottom: 2px solid var(--color-primary);
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
export class ProcurementComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  activeTab: 'po' | 'grn' = 'po';

  purchaseOrders = signal<PurchaseOrder[]>([]);
  grns = signal<GoodsReceiptNote[]>([]);
  products = signal<Product[]>([]);

  loading = signal(true);
  submitting = signal(false);
  selectedPO = signal<PurchaseOrder | null>(null);

  receiveForm = {
    product_id: '',
    received_qty: 100,
    notes: 'Kondisi barang baik & sesuai faktur'
  };

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.loadPurchaseOrders();
    this.loadGRNs();
    this.loadProducts();
  }

  loadPurchaseOrders() {
    this.http.get<ApiResponse<PurchaseOrder[]>>('/api/v1/procurement/purchase-orders')
      .subscribe({
        next: (res) => {
          this.purchaseOrders.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat purchase orders');
          this.loading.set(false);
        }
      });
  }

  loadGRNs() {
    this.http.get<ApiResponse<GoodsReceiptNote[]>>('/api/v1/procurement/grn')
      .subscribe({
        next: (res) => {
          this.grns.set(res.data || []);
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

  approvePO(poId: string) {
    this.http.post<ApiResponse<any>>(`/api/v1/procurement/purchase-orders/${poId}/approve`, {})
      .subscribe({
        next: () => {
          this.notify.success('Purchase order berhasil disetujui');
          this.loadPurchaseOrders();
        },
        error: (err) => {
          this.notify.error(err.error?.message || 'Gagal menyetujui PO');
        }
      });
  }

  openReceiveModal(po: PurchaseOrder) {
    if (po.status === 'PENDING') {
      this.approvePO(po.id);
    }
    this.selectedPO.set(po);
    this.receiveForm = {
      product_id: this.products().length > 0 ? this.products()[0].id : '',
      received_qty: 100,
      notes: 'Kondisi barang baik & sesuai faktur'
    };

    // Pre-fill from PO details if available
    this.http.get<ApiResponse<{ purchase_order: PurchaseOrder; items: PurchaseOrderItem[] }>>(`/api/v1/procurement/purchase-orders/${po.id}`)
      .subscribe({
        next: (res) => {
          if (res.data?.items && res.data.items.length > 0) {
            const item = res.data.items[0];
            this.receiveForm.product_id = item.product_id;
            this.receiveForm.received_qty = item.ordered_qty;
          }
        }
      });
  }

  closeReceiveModal() {
    this.selectedPO.set(null);
  }

  submitGRN() {
    const po = this.selectedPO();
    if (!po) return;

    this.submitting.set(true);
    this.http.post<ApiResponse<any>>('/api/v1/procurement/grn', {
      purchase_order_id: po.id,
      items: [
        {
          product_id: this.receiveForm.product_id,
          received_qty: Number(this.receiveForm.received_qty),
          notes: this.receiveForm.notes
        }
      ]
    }).subscribe({
      next: () => {
        this.notify.success('GRN tercatat! Stok inventaris gudang telah bertambah secara otomatis.');
        this.closeReceiveModal();
        this.submitting.set(false);
        this.activeTab = 'grn';
        this.loadAllData();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal menyimpan GRN');
        this.submitting.set(false);
      }
    });
  }
}
