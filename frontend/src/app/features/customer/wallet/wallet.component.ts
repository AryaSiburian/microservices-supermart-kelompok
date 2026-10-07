import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { StoreCredit, CreditTransaction, LoyaltyPoint } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container wallet-page">
      <div class="page-header">
        <h1>Dompet Digital & Loyalitas</h1>
        <p>Kelola saldo kredit toko Nusantara dan tukarkan poin loyalitas belanja Anda</p>
      </div>

      <div class="wallet-cards-grid">
        <!-- Balance Card -->
        <div class="card balance-card">
          <span class="card-icon">👛</span>
          <span class="card-lbl">Saldo Store Credit</span>
          <div class="balance-display">
            <span class="curr">Rp</span>
            <span class="val">{{ credit()?.balance || 0 | number:'1.0-0' }}</span>
          </div>
          <p class="balance-hint">Dapat digunakan langsung untuk belanja cepat tanpa biaya admin.</p>
          <button (click)="openTopupModal.set(true)" class="btn btn-primary" id="btn-topup-wallet">
            + Isi Ulang Saldo
          </button>
        </div>

        <!-- Loyalty Card -->
        <div class="card loyalty-card">
          <span class="card-icon">⭐</span>
          <span class="card-lbl">Poin Loyalitas SuperMart</span>
          <div class="loyalty-display">
            <span class="points-val">{{ loyalty()?.current_points || 0 }}</span>
            <span class="points-unit">POIN</span>
          </div>
          <p class="balance-hint">Dapatkan 1 poin setiap belanja kelipatan Rp 1.000.</p>
          <button (click)="redeemPoints()" class="btn btn-outline" id="btn-redeem-points" [disabled]="(loyalty()?.current_points || 0) < 100">
            🎁 Tukar Diskon Rp 10.000 (100 Poin)
          </button>
        </div>
      </div>

      <!-- Transactions Ledger -->
      <div class="ledger-section card">
        <h3>Riwayat Transaksi Dompet</h3>

        @if (transactions().length === 0) {
          <p class="empty-text">Belum ada riwayat transaksi mutasi kredit.</p>
        } @else {
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th>Keterangan</th>
                  <th>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                @for (tx of transactions(); track tx.id) {
                  <tr>
                    <td>{{ tx.created_at | date:'dd MMM yyyy, HH:mm' }}</td>
                    <td>
                      <span class="badge" [class.badge-success]="tx.transaction_type === 'CREDIT'" [class.badge-danger]="tx.transaction_type === 'DEBIT'">
                        {{ tx.transaction_type }}
                      </span>
                    </td>
                    <td>{{ tx.description || '-' }}</td>
                    <td>
                      <strong [class.credit-text]="tx.transaction_type === 'CREDIT'" [class.debit-text]="tx.transaction_type === 'DEBIT'">
                        {{ tx.transaction_type === 'CREDIT' ? '+' : '-' }} Rp {{ tx.amount | number:'1.0-0' }}
                      </strong>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Topup Modal -->
      @if (openTopupModal()) {
        <div class="modal-backdrop" (click)="openTopupModal.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Isi Ulang Saldo Dompet</h3>
              <button (click)="openTopupModal.set(false)" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nominal Top Up</label>
                <input
                  type="number"
                  class="form-control"
                  [(ngModel)]="topupAmount"
                  placeholder="Minimal Rp 10.000"
                  step="10000"
                />
              </div>

              <div class="quick-amounts">
                <button (click)="topupAmount = 50000" class="btn btn-outline btn-sm">Rp 50.000</button>
                <button (click)="topupAmount = 100000" class="btn btn-outline btn-sm">Rp 100.000</button>
                <button (click)="topupAmount = 250000" class="btn btn-outline btn-sm">Rp 250.000</button>
              </div>

              <button
                (click)="submitTopup()"
                class="btn btn-primary btn-lg"
                style="width: 100%; margin-top: 1.5rem;"
                [disabled]="topupAmount <= 0"
              >
                Konfirmasi Top Up Saldo →
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .wallet-page {
      padding-bottom: 3rem;
    }
    .page-header {
      margin-bottom: 2rem;
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
    .wallet-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .balance-card, .loyalty-card {
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .card-icon {
      font-size: 2.25rem;
      margin-bottom: 0.5rem;
    }
    .card-lbl {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .balance-display, .loyalty-display {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      margin: 0.5rem 0 0.75rem;
    }
    .curr {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-primary);
    }
    .val, .points-val {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .points-unit {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-accent);
    }
    .balance-hint {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    .ledger-section {
      padding: 1.75rem;
    }
    .ledger-section h3 {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .credit-text { color: var(--color-secondary); }
    .debit-text { color: var(--color-danger); }
    .empty-text {
      color: var(--text-muted);
      font-size: 0.875rem;
      padding: 1.5rem 0;
      text-align: center;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1rem;
    }
    .modal {
      width: 100%;
      max-width: 440px;
      padding: 2rem;
      background: white;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .close-btn {
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
    }
    .quick-amounts {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `]
})
export class WalletComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  credit = signal<StoreCredit | null>(null);
  transactions = signal<CreditTransaction[]>([]);
  loyalty = signal<LoyaltyPoint | null>(null);

  openTopupModal = signal(false);
  topupAmount = 100000;

  ngOnInit() {
    this.loadWalletData();
    this.loadLoyalty();
  }

  loadWalletData() {
    this.http.get<APIResponse<{ credit: StoreCredit; transactions: CreditTransaction[] }>>('/api/v1/payments/credits').subscribe(res => {
      if (res.success && res.data) {
        this.credit.set(res.data.credit);
        this.transactions.set(res.data.transactions || []);
      }
    });
  }

  loadLoyalty() {
    this.http.get<APIResponse<{ points: LoyaltyPoint }>>('/api/v1/promotions/loyalty').subscribe(res => {
      if (res.success && res.data) {
        this.loyalty.set(res.data.points);
      }
    });
  }

  submitTopup() {
    if (this.topupAmount <= 0) return;
    this.http.post<APIResponse<null>>('/api/v1/payments/credits/topup', {
      amount: this.topupAmount
    }).subscribe({
      next: () => {
        this.notify.success(`Berhasil menambah saldo Rp ${this.topupAmount.toLocaleString()}`);
        this.openTopupModal.set(false);
        this.loadWalletData();
      },
      error: () => this.notify.error('Gagal melakukan topup saldo')
    });
  }

  redeemPoints() {
    this.http.post<APIResponse<null>>('/api/v1/promotions/loyalty/redeem', {
      reward_name: 'Voucher Diskon Belanja Rp 10.000',
      points_deducted: 100
    }).subscribe({
      next: () => {
        this.notify.success('100 Poin berhasil ditukarkan!');
        this.loadLoyalty();
      },
      error: (err) => this.notify.error(err.error?.message || 'Gagal menukarkan poin')
    });
  }
}
