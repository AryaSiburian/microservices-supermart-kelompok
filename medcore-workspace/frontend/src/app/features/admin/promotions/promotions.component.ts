import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Voucher, Promotion, ApiResponse } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container promo-page">
      <div class="page-header">
        <div>
          <span class="badge badge-purple">Super Admin Console</span>
          <h1 class="page-title">Manajemen Promosi, Diskon & Voucher</h1>
          <p class="text-secondary">Kelola voucher potongan belanja, kupon diskon, dan kampanye loyalitas pelanggan.</p>
        </div>
        <div class="header-actions">
          <button (click)="openAddVoucherModal()" class="btn btn-primary">
            🎟️ Buat Voucher Baru
          </button>
          <button (click)="loadAllData()" class="btn btn-outline" [disabled]="loading()">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs mb-6">
        <button 
          (click)="activeTab = 'vouchers'" 
          class="tab-btn" 
          [class.active]="activeTab === 'vouchers'"
        >
          🎟️ Voucher Diskon ({{ vouchers().length }})
        </button>
        <button 
          (click)="activeTab = 'campaigns'" 
          class="tab-btn" 
          [class.active]="activeTab === 'campaigns'"
        >
          📢 Kampanye Promosi ({{ campaigns().length }})
        </button>
      </div>

      <!-- TAB 1: VOUCHERS -->
      @if (activeTab === 'vouchers') {
        <div class="card p-0">
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="font-bold text-lg">Daftar Kode Voucher Belanja</h3>
            <span class="text-sm text-secondary">Pelanggan dapat memasukkan kode voucher saat checkout</span>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat data voucher...</p>
            </div>
          } @else if (vouchers().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Belum ada voucher promosi yang aktif.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Kode Voucher</th>
                    <th class="text-right">Nilai Potongan</th>
                    <th class="text-center">Kuota Terpakai</th>
                    <th class="text-center">Sisa Kuota</th>
                    <th>Masa Berlaku</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of vouchers(); track v.id) {
                    <tr>
                      <td>
                        <span class="voucher-code-badge font-mono font-bold">{{ v.voucher_code }}</span>
                      </td>
                      <td class="text-right font-bold text-success">
                        Rp {{ v.voucher_value | number:'1.0-0' }}
                      </td>
                      <td class="text-center font-semibold">
                        {{ v.quota_used }} / {{ v.quota_limit }}
                      </td>
                      <td class="text-center">
                        <span class="font-bold text-primary">
                          {{ v.quota_limit - v.quota_used }}
                        </span>
                      </td>
                      <td class="text-secondary text-sm">
                        Sampai {{ v.expires_at | date:'dd MMM yyyy' }}
                      </td>
                      <td>
                        @if (v.quota_used >= v.quota_limit) {
                          <span class="badge badge-danger">HABIS</span>
                        } @else {
                          <span class="badge badge-success">AKTIF</span>
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

      <!-- TAB 2: CAMPAIGNS -->
      @if (activeTab === 'campaigns') {
        <div class="card p-0">
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="font-bold text-lg">Kampanye Pemasaran & Diskon Musiman</h3>
            <button (click)="openAddPromoModal()" class="btn btn-outline btn-sm">
              ➕ Tambah Kampanye
            </button>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat kampanye promosi...</p>
            </div>
          } @else if (campaigns().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Belum ada program promosi musiman.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nama Kampanye</th>
                    <th>Deskripsi</th>
                    <th>Periode Mulai</th>
                    <th>Periode Berakhir</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of campaigns(); track c.id) {
                    <tr>
                      <td class="font-bold text-primary">{{ c.promo_name }}</td>
                      <td class="text-secondary">{{ c.description }}</td>
                      <td class="text-sm">{{ c.start_date | date:'dd MMM yyyy' }}</td>
                      <td class="text-sm">{{ c.end_date | date:'dd MMM yyyy' }}</td>
                      <td>
                        @if (c.is_active) {
                          <span class="badge badge-success">BERJALAN</span>
                        } @else {
                          <span class="badge badge-secondary">SELESAI</span>
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

      <!-- Add Voucher Modal -->
      @if (showVoucherModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Buat Kode Voucher Belanja Baru</h3>
              <button (click)="closeAddVoucherModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <form (ngSubmit)="submitVoucher()">
                <div class="form-group mb-3">
                  <label class="form-label">Kode Unik Voucher (Huruf Besar) *</label>
                  <input 
                    type="text" 
                    [(ngModel)]="newVoucher.voucher_code" 
                    name="voucher_code" 
                    class="form-control font-mono font-bold" 
                    placeholder="SUPERDISKON20" 
                    required
                  />
                </div>

                <div class="grid grid-2 gap-4 mb-3">
                  <div class="form-group">
                    <label class="form-label">Nominal Potongan (Rp) *</label>
                    <input 
                      type="number" 
                      [(ngModel)]="newVoucher.voucher_value" 
                      name="voucher_value" 
                      class="form-control" 
                      min="1000" 
                      placeholder="20000" 
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Batas Kuota Pemakaian *</label>
                    <input 
                      type="number" 
                      [(ngModel)]="newVoucher.quota_limit" 
                      name="quota_limit" 
                      class="form-control" 
                      min="1" 
                      placeholder="100" 
                      required
                    />
                  </div>
                </div>

                <div class="form-group mb-4">
                  <label class="form-label">Berlaku Sampai Tanggal *</label>
                  <input 
                    type="date" 
                    [(ngModel)]="newVoucher.expires_at" 
                    name="expires_at" 
                    class="form-control" 
                    required
                  />
                </div>

                <div class="modal-footer">
                  <button type="button" (click)="closeAddVoucherModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
                  <button type="submit" class="btn btn-primary" [disabled]="submitting() || !isVoucherValid()">
                    @if (submitting()) { Menyimpan... } @else { Buat Voucher }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }

      <!-- Add Promotion Modal -->
      @if (showPromoModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Tambah Program Promosi Baru</h3>
              <button (click)="closeAddPromoModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
              <form (ngSubmit)="submitPromotion()">
                <div class="grid grid-2 gap-4 mb-3">
                  <div class="form-group">
                    <label class="form-label">Kode Promo *</label>
                    <input 
                      type="text" 
                      [(ngModel)]="newPromo.promo_code" 
                      name="promo_code" 
                      class="form-control font-mono font-bold" 
                      placeholder="PROMO-MERDEKA" 
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nama Promosi *</label>
                    <input 
                      type="text" 
                      [(ngModel)]="newPromo.promo_name" 
                      name="promo_name" 
                      class="form-control" 
                      placeholder="Pesta Diskon Akbar" 
                      required
                    />
                  </div>
                </div>

                <div class="grid grid-2 gap-4 mb-4">
                  <div class="form-group">
                    <label class="form-label">Tanggal Mulai *</label>
                    <input 
                      type="date" 
                      [(ngModel)]="newPromo.start_date" 
                      name="start_date" 
                      class="form-control" 
                      required
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tanggal Selesai *</label>
                    <input 
                      type="date" 
                      [(ngModel)]="newPromo.end_date" 
                      name="end_date" 
                      class="form-control" 
                      required
                    />
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" (click)="closeAddPromoModal()" class="btn btn-outline" [disabled]="submitting()">Batal</button>
                  <button type="submit" class="btn btn-primary" [disabled]="submitting() || !newPromo.promo_name">
                    @if (submitting()) { Menyimpan... } @else { Simpan Promosi }
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
    .promo-page {
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
    .badge-purple {
      background: #f3e8ff;
      color: #7e22ce;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: var(--radius-sm);
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
    .voucher-code-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px dashed #3b82f6;
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-sm);
      letter-spacing: 0.05em;
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
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
  `]
})
export class PromotionsComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  activeTab: 'vouchers' | 'campaigns' = 'vouchers';

  vouchers = signal<Voucher[]>([]);
  campaigns = signal<Promotion[]>([]);

  loading = signal(true);
  submitting = signal(false);

  showVoucherModal = signal(false);
  showPromoModal = signal(false);

  newVoucher = {
    voucher_code: '',
    voucher_value: 20000,
    quota_limit: 100,
    expires_at: '2026-12-31'
  };

  newPromo = {
    promo_code: '',
    promo_name: '',
    start_date: '2026-09-01',
    end_date: '2026-12-31'
  };

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.loadVouchers();
    this.loadPromotions();
  }

  loadVouchers() {
    this.http.get<ApiResponse<Voucher[]>>('/api/v1/promotions/vouchers')
      .subscribe({
        next: (res) => {
          this.vouchers.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat daftar voucher');
          this.loading.set(false);
        }
      });
  }

  loadPromotions() {
    this.http.get<ApiResponse<Promotion[]>>('/api/v1/promotions/')
      .subscribe({
        next: (res) => {
          this.campaigns.set(res.data || []);
        }
      });
  }

  openAddVoucherModal() {
    this.newVoucher = {
      voucher_code: 'SUPER' + Math.floor(10 + Math.random() * 90),
      voucher_value: 25000,
      quota_limit: 50,
      expires_at: '2026-12-31'
    };
    this.showVoucherModal.set(true);
  }

  closeAddVoucherModal() {
    this.showVoucherModal.set(false);
  }

  isVoucherValid(): boolean {
    return !!this.newVoucher.voucher_code && this.newVoucher.voucher_value > 0 && this.newVoucher.quota_limit > 0;
  }

  submitVoucher() {
    this.submitting.set(true);
    this.http.post<ApiResponse<any>>('/api/v1/promotions/vouchers', {
      voucher_code: this.newVoucher.voucher_code.toUpperCase().trim(),
      voucher_value: Number(this.newVoucher.voucher_value),
      quota_limit: Number(this.newVoucher.quota_limit),
      expires_at: this.newVoucher.expires_at
    }).subscribe({
      next: () => {
        this.notify.success('Voucher belanja baru berhasil dibuat!');
        this.closeAddVoucherModal();
        this.submitting.set(false);
        this.loadVouchers();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal membuat voucher');
        this.submitting.set(false);
      }
    });
  }

  openAddPromoModal() {
    this.newPromo = {
      promo_code: 'PROMO-' + Math.floor(100 + Math.random() * 900),
      promo_name: '',
      start_date: '2026-09-01',
      end_date: '2026-12-31'
    };
    this.showPromoModal.set(true);
  }

  closeAddPromoModal() {
    this.showPromoModal.set(false);
  }

  submitPromotion() {
    this.submitting.set(true);
    this.http.post<ApiResponse<any>>('/api/v1/promotions/', {
      promo_code: this.newPromo.promo_code.toUpperCase().trim(),
      promo_name: this.newPromo.promo_name,
      start_date: this.newPromo.start_date,
      end_date: this.newPromo.end_date
    }).subscribe({
      next: () => {
        this.notify.success('Program promosi berhasil ditambahkan!');
        this.closeAddPromoModal();
        this.submitting.set(false);
        this.loadPromotions();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal membuat promosi');
        this.submitting.set(false);
      }
    });
  }
}
