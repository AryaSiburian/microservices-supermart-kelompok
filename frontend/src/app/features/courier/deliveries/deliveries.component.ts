import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ShippingOrder, ApiResponse } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-courier-deliveries',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container courier-page">
      <div class="page-header">
        <div>
          <span class="badge badge-warning">Last-Mile Courier Portal</span>
          <h1 class="page-title">Pengantaran & Bukti Pengiriman (POD)</h1>
          <p class="text-secondary">Kelola armada kurir, pembaruan status logistik dan konfirmasi penerimaan barang (POD).</p>
        </div>
        <div class="header-actions">
          <button (click)="loadShipments()" class="btn btn-outline" [disabled]="loading()">
            🔄 Muat Ulang
          </button>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="stats-grid mb-6">
        <div class="card stat-card">
          <div class="stat-icon bg-warning-subtle">🚚</div>
          <div class="stat-content">
            <span class="stat-label">Total Pengiriman</span>
            <span class="stat-value">{{ shipments().length }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-info-subtle">📍</div>
          <div class="stat-content">
            <span class="stat-label">Dalam Perjalanan (In Transit)</span>
            <span class="stat-value">{{ countInTransit() }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-success-subtle">🏁</div>
          <div class="stat-content">
            <span class="stat-label">Terkirim Berhasil (Delivered)</span>
            <span class="stat-value text-success">{{ countDelivered() }}</span>
          </div>
        </div>
      </div>

      <!-- Shipments List Card -->
      <div class="card p-0">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="font-bold text-lg">Daftar Paket Pengiriman</h3>
          <div class="filter-pills">
            <button 
              (click)="statusFilter = 'ALL'" 
              class="pill-btn" 
              [class.active]="statusFilter === 'ALL'"
            >
              Semua
            </button>
            <button 
              (click)="statusFilter = 'READY'" 
              class="pill-btn" 
              [class.active]="statusFilter === 'READY'"
            >
              Siap Kirim
            </button>
            <button 
              (click)="statusFilter = 'IN_TRANSIT'" 
              class="pill-btn" 
              [class.active]="statusFilter === 'IN_TRANSIT'"
            >
              Dalam Perjalanan
            </button>
            <button 
              (click)="statusFilter = 'DELIVERED'" 
              class="pill-btn" 
              [class.active]="statusFilter === 'DELIVERED'"
            >
              Selesai (POD)
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="p-8 text-center">
            <div class="spinner"></div>
            <p class="mt-2 text-secondary">Memuat data penugasan pengiriman...</p>
          </div>
        } @else if (filteredShipments().length === 0) {
          <div class="p-8 text-center text-secondary">
            <p>Tidak ada paket pengiriman yang sesuai dengan kriteria filter.</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>No. Resi (Tracking)</th>
                  <th>Pesanan / Tujuan</th>
                  <th>Layanan</th>
                  <th>Berat</th>
                  <th>Status Kurir</th>
                  <th class="text-right">Aksi Penanganan</th>
                </tr>
              </thead>
              <tbody>
                @for (s of filteredShipments(); track s.id) {
                  <tr>
                    <td>
                      <div class="tracking-cell">
                        <span class="font-mono font-bold text-primary">{{ s.tracking_number }}</span>
                        <span class="text-xs text-secondary">ID: {{ s.id.substring(0, 8) }}...</span>
                      </div>
                    </td>
                    <td>
                      <div class="order-cell">
                        <span class="font-semibold">{{ s.order_number || s.order_id }}</span>
                        <span class="text-sm text-secondary">{{ s.customer_name || 'Pelanggan SuperMart' }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-info">{{ s.service_name || 'Express' }}</span>
                    </td>
                    <td class="font-semibold">{{ s.weight_kg }} kg</td>
                    <td>
                      @switch (s.current_status) {
                        @case ('DELIVERED') {
                          <span class="badge badge-success">✅ TERKIRIM (POD)</span>
                        }
                        @case ('IN_TRANSIT') {
                          <span class="badge badge-warning">🚚 DALAM PERJALANAN</span>
                        }
                        @case ('PICKED_UP') {
                          <span class="badge badge-info">📦 SUDAH DIJEMPUT</span>
                        }
                        @case ('READY_FOR_PICKUP') {
                          <span class="badge badge-warning">📦 SIAP DIJEMPUT</span>
                        }
                        @case ('READY') {
                          <span class="badge badge-warning">📦 SIAP KIRIM</span>
                        }
                        @case ('MANIFESTED') {
                          <span class="badge badge-secondary">📋 MANIFESTED</span>
                        }
                        @default {
                          <span class="badge badge-secondary">{{ s.current_status }}</span>
                        }
                      }
                    </td>
                    <td class="text-right">
                      <div class="action-buttons">
                        @if (s.current_status === 'PENDING' || s.current_status === 'READY_FOR_PICKUP' || s.current_status === 'READY' || s.current_status === 'MANIFESTED') {
                          <button (click)="updateStatus(s.id, 'PICKED_UP')" class="btn btn-outline btn-sm">
                            Jemput Paket
                          </button>
                        }
                        @if (s.current_status === 'PICKED_UP') {
                          <button (click)="updateStatus(s.id, 'IN_TRANSIT')" class="btn btn-outline btn-sm">
                            Mulai Antar
                          </button>
                        }
                        @if (s.current_status === 'IN_TRANSIT' || s.current_status === 'PICKED_UP') {
                          <button (click)="openPODModal(s)" class="btn btn-primary btn-sm">
                            📝 Selesaikan (POD)
                          </button>
                        }
                        @if (s.current_status === 'DELIVERED') {
                          <span class="text-xs text-success font-semibold">Tuntas</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Proof of Delivery (POD) Modal -->
      @if (selectedShipment()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Konfirmasi Bukti Pengiriman (POD)</h3>
              <button (click)="closePODModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <p class="text-secondary mb-4">
                Selesaikan pengantaran untuk resi <strong>{{ selectedShipment()?.tracking_number }}</strong>.
              </p>

              <div class="form-group mb-4">
                <label class="form-label">Nama Penerima Fisik *</label>
                <input 
                  type="text" 
                  [(ngModel)]="podForm.recipient_name" 
                  class="form-control" 
                  placeholder="Nama orang yang menerima paket (misal: Bpk Budi / Satpam)"
                  required
                />
              </div>

              <div class="form-group mb-4">
                <label class="form-label">URL Foto Bukti Serah Terima *</label>
                <input 
                  type="text" 
                  [(ngModel)]="podForm.photo_proof_url" 
                  class="form-control" 
                  placeholder="https://images.unsplash.com/photo-..."
                  required
                />
                <small class="text-secondary mt-1">Dapat menggunakan mock URL gambar verifikasi pengantaran.</small>
              </div>

              <div class="form-group">
                <label class="form-label">Catatan Tambahan</label>
                <input 
                  type="text" 
                  [(ngModel)]="podNotes" 
                  class="form-control" 
                  placeholder="Paket diterima langsung oleh pemilik dalam kondisi prima"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button (click)="closePODModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
              <button 
                (click)="submitPOD()" 
                class="btn btn-primary" 
                [disabled]="submitting() || !podForm.recipient_name"
              >
                @if (submitting()) { Mengonfirmasi POD... } @else { Konfirmasi Paket Diterima }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .courier-page {
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
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
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
    .bg-warning-subtle { background: #fef3c7; }
    .bg-info-subtle { background: #e0f2fe; }
    .bg-success-subtle { background: #dcfce7; }
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
    .filter-pills {
      display: flex;
      gap: 0.375rem;
    }
    .pill-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .pill-btn.active {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .tracking-cell {
      display: flex;
      flex-direction: column;
    }
    .order-cell {
      display: flex;
      flex-direction: column;
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
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
export class DeliveriesComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  shipments = signal<ShippingOrder[]>([]);
  loading = signal(true);
  submitting = signal(false);

  statusFilter = 'ALL';
  selectedShipment = signal<ShippingOrder | null>(null);

  podForm = {
    recipient_name: '',
    photo_proof_url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=500&auto=format&fit=crop'
  };
  podNotes = '';

  ngOnInit() {
    this.loadShipments();
  }

  loadShipments() {
    this.loading.set(true);
    this.http.get<ApiResponse<ShippingOrder[]>>('/api/v1/logistics/shipments')
      .subscribe({
        next: (res) => {
          this.shipments.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat daftar pengiriman');
          this.loading.set(false);
        }
      });
  }

  filteredShipments(): ShippingOrder[] {
    if (this.statusFilter === 'ALL') return this.shipments();
    if (this.statusFilter === 'READY') {
      return this.shipments().filter(s =>
        s.current_status === 'READY' ||
        s.current_status === 'READY_FOR_PICKUP' ||
        s.current_status === 'MANIFESTED' ||
        s.current_status === 'PENDING'
      );
    }
    return this.shipments().filter(s => s.current_status === this.statusFilter);
  }

  countInTransit(): number {
    return this.shipments().filter(s => s.current_status === 'IN_TRANSIT').length;
  }

  countDelivered(): number {
    return this.shipments().filter(s => s.current_status === 'DELIVERED').length;
  }

  updateStatus(id: string, status: string) {
    this.http.put<ApiResponse<any>>(`/api/v1/logistics/shipments/${id}/status`, {
      status: status,
      location: 'Hub Kurir Nusantara',
      description: `Status pengiriman diperbarui ke ${status}`
    }).subscribe({
      next: () => {
        this.notify.success(`Status berhasil diubah menjadi ${status}`);
        this.loadShipments();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal mengubah status pengiriman');
      }
    });
  }

  openPODModal(shipment: ShippingOrder) {
    this.selectedShipment.set(shipment);
    this.podForm = {
      recipient_name: shipment.customer_name || 'Penerima Rumah',
      photo_proof_url: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=500&auto=format&fit=crop'
    };
    this.podNotes = 'Paket diterima dalam keadaan baik';
  }

  closePODModal() {
    this.selectedShipment.set(null);
  }

  submitPOD() {
    const s = this.selectedShipment();
    if (!s) return;

    this.submitting.set(true);
    this.http.post<ApiResponse<any>>(`/api/v1/logistics/shipments/${s.id}/pod`, {
      recipient_name: this.podForm.recipient_name,
      photo_proof_url: this.podForm.photo_proof_url
    }).subscribe({
      next: () => {
        this.notify.success('Bukti pengiriman (POD) berhasil disimpan! Pesanan ditandai selesai.');
        this.closePODModal();
        this.submitting.set(false);
        this.loadShipments();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal menyimpan POD');
        this.submitting.set(false);
      }
    });
  }
}
