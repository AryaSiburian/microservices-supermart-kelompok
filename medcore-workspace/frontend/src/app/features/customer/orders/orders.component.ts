import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Order, PaymentMethod, PaymentInvoice } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container orders-page">
      <div class="page-header">
        <h1>Daftar Pesanan Saya</h1>
        <p>Riwayat transaksi, status pengiriman kurir, dan pembayaran faktur</p>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <p>Memuat riwayat pesanan...</p>
        </div>
      } @else if (orders().length === 0) {
        <div class="empty-state card">
          <span class="empty-icon">📦</span>
          <h3>Belum ada transaksi pesanan</h3>
          <p>Mulai belanja produk kebutuhan harian Anda sekarang.</p>
          <a routerLink="/catalog" class="btn btn-primary" id="btn-browse-catalog">Katalog Belanja</a>
        </div>
      } @else {
        <div class="orders-list">
          @for (order of orders(); track order.id) {
            <div class="order-card card">
              <div class="order-card-header">
                <div class="header-left">
                  <span class="order-num">{{ order.order_number }}</span>
                  <span class="order-date">{{ order.created_at | date:'dd MMM yyyy, HH:mm' }}</span>
                </div>
                <div class="header-right">
                  <span class="badge" [ngClass]="getStatusBadgeClass(order.status_code || '')">
                    {{ order.status_name || order.status_code }}
                  </span>
                </div>
              </div>

              <div class="order-card-body">
                <div class="body-info">
                  <div class="info-group">
                    <span class="info-label">Gudang Pemenuhan</span>
                    <span class="info-val">🏭 {{ order.warehouse_name }}</span>
                  </div>
                  <div class="info-group">
                    <span class="info-label">Alamat Penerima</span>
                    <span class="info-val">📍 {{ order.shipping_address }}</span>
                  </div>
                </div>

                <div class="body-pricing">
                  <span class="price-label">Total Pembayaran</span>
                  <span class="price-val">Rp {{ order.total_net_amount | number:'1.0-0' }}</span>
                </div>
              </div>

              <div class="order-card-footer">
                <button (click)="viewDetails(order.id)" class="btn btn-outline btn-sm">
                  🔍 Detail Pesanan
                </button>

                <div class="footer-actions">
                  @if (order.status_code === 'AWAITING_PAYMENT') {
                    <button (click)="openPayModal(order)" class="btn btn-primary btn-sm" id="btn-pay-order">
                      💳 Bayar Sekarang
                    </button>
                    <button (click)="cancelOrder(order.id)" class="btn btn-outline btn-sm btn-danger-text">
                      Batalkan
                    </button>
                  }
                  @if (order.status_code === 'SHIPPED') {
                    <a [routerLink]="['/support']" class="btn btn-outline btn-sm">
                      🎧 Lacak Kurir
                    </a>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Payment Simulator Modal -->
      @if (selectedOrderToPay()) {
        <div class="modal-backdrop" (click)="selectedOrderToPay.set(null)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Pembayaran Pesanan</h3>
              <button (click)="selectedOrderToPay.set(null)" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <p>Nomor Pesanan: <strong>{{ selectedOrderToPay()?.order_number }}</strong></p>
              <p class="modal-amount">Total Tagihan: <span>Rp {{ selectedOrderToPay()?.total_net_amount | number:'1.0-0' }}</span></p>

              <div class="form-group" style="margin-top: 1rem;">
                <label class="form-label">Pilih Metode Pembayaran</label>
                <div class="payment-methods-grid">
                  @for (pm of paymentMethods(); track pm.id) {
                    <div
                      class="pm-card"
                      [class.selected]="selectedPaymentMethodId === pm.id"
                      (click)="selectedPaymentMethodId = pm.id"
                      style="cursor: pointer;"
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        [value]="pm.id"
                        [checked]="selectedPaymentMethodId === pm.id"
                        (change)="selectedPaymentMethodId = pm.id"
                      />
                      <div>
                        <strong>{{ pm.method_name }}</strong>
                        <span class="pm-code">{{ pm.method_code }}</span>
                      </div>
                    </div>
                  }
                  @if (paymentMethods().length === 0) {
                    <p class="text-muted" style="padding: 1rem;">Memuat daftar metode pembayaran...</p>
                  }
                </div>
              </div>

              <button
                (click)="processPayment()"
                class="btn btn-primary btn-lg"
                style="width: 100%; margin-top: 1rem;"
                [disabled]="paying() || !selectedPaymentMethodId"
                id="btn-confirm-pay"
              >
                @if (paying()) {
                  <span>Memverifikasi Pembayaran...</span>
                } @else {
                  <span>Konfirmasi & Lunasi Pembayaran →</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Order Details Modal -->
      @if (orderDetail()) {
        <div class="modal-backdrop" (click)="orderDetail.set(null)">
          <div class="modal card detail-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Detail Pesanan #{{ orderDetail()?.order?.order_number }}</h3>
              <button (click)="orderDetail.set(null)" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <h4>Item yang Dipesan</h4>
              <div class="table-container" style="margin-bottom: 1.5rem;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Jumlah</th>
                      <th>Harga</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of orderDetail()?.items; track item.id) {
                      <tr>
                        <td>{{ item.product_title }}</td>
                        <td>{{ item.quantity }}x</td>
                        <td>Rp {{ item.unit_price | number:'1.0-0' }}</td>
                        <td><strong>Rp {{ item.subtotal | number:'1.0-0' }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <h4>Riwayat Status & Pelacakan</h4>
              <div class="timeline">
                @for (hist of orderDetail()?.histories; track hist.id) {
                  <div class="timeline-item">
                    <span class="timeline-dot"></span>
                    <div class="timeline-content">
                      <strong>{{ hist.status_name }}</strong>
                      <span class="timeline-date">{{ hist.created_at | date:'dd MMM yyyy, HH:mm' }}</span>
                      @if (hist.notes) {
                        <p class="timeline-notes">{{ hist.notes }}</p>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .orders-page {
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
    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .order-card {
      padding: 1.5rem;
    }
    .order-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    .header-left {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }
    .order-num {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .order-date {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .order-card-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .body-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .info-label {
      font-size: 0.6875rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .info-val {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .body-pricing {
      text-align: right;
    }
    .price-label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .price-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--color-primary-dark);
    }
    .order-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
    }
    .footer-actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-danger-text {
      color: var(--color-danger);
    }
    .badge-awaiting { background: var(--color-accent-light); color: #b45309; }
    .badge-processing { background: var(--color-primary-light); color: var(--color-primary-dark); }
    .badge-shipped { background: #ede9fe; color: #7c3aed; }
    .badge-completed { background: var(--color-secondary-light); color: var(--color-secondary-hover); }
    .badge-cancelled { background: var(--color-danger-light); color: var(--color-danger); }
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
      max-width: 500px;
      padding: 2rem;
      background: white;
      max-height: 90vh;
      overflow-y: auto;
    }
    .detail-modal {
      max-width: 650px;
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
    .modal-amount {
      font-size: 1.125rem;
      margin-top: 0.25rem;
    }
    .modal-amount span {
      font-weight: 800;
      color: var(--color-primary-dark);
    }
    .payment-methods-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .pm-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      cursor: pointer;
    }
    .pm-card.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-light);
    }
    .pm-code {
      display: block;
      font-size: 0.6875rem;
      color: var(--text-muted);
    }
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border-left: 2px solid var(--border-color);
      margin-left: 0.5rem;
      padding-left: 1rem;
      margin-top: 0.75rem;
    }
    .timeline-item {
      position: relative;
    }
    .timeline-dot {
      position: absolute;
      left: -1.375rem;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: var(--radius-full);
      background: var(--color-primary);
    }
    .timeline-content strong {
      display: block;
      font-size: 0.875rem;
      color: var(--text-primary);
    }
    .timeline-date {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .timeline-notes {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-icon {
      font-size: 3rem;
      display: inline-block;
      margin-bottom: 1rem;
    }
  `]
})
export class OrdersComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  paying = signal(false);

  selectedOrderToPay = signal<Order | null>(null);
  orderDetail = signal<any | null>(null);
  paymentMethods = signal<PaymentMethod[]>([]);
  selectedPaymentMethodId = '';

  ngOnInit() {
    this.loadOrders();
    this.loadPaymentMethods();
  }

  loadOrders() {
    this.loading.set(true);
    this.http.get<APIResponse<Order[]>>('/api/v1/orders').subscribe({
      next: res => {
        if (res.success) {
          this.orders.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadPaymentMethods() {
    this.http.get<APIResponse<PaymentMethod[]>>('/api/v1/payments/methods').subscribe(res => {
      if (res.success && res.data) {
        this.paymentMethods.set(res.data);
        if (res.data.length > 0) {
          this.selectedPaymentMethodId = res.data[0].id;
        }
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'AWAITING_PAYMENT': return 'badge-awaiting';
      case 'PROCESSING': return 'badge-processing';
      case 'SHIPPED': return 'badge-shipped';
      case 'COMPLETED': return 'badge-completed';
      case 'CANCELLED': return 'badge-cancelled';
      default: return 'badge-primary';
    }
  }

  openPayModal(order: Order) {
    this.selectedOrderToPay.set(order);
    if (!this.selectedPaymentMethodId && this.paymentMethods().length > 0) {
      this.selectedPaymentMethodId = this.paymentMethods()[0].id;
    }
  }

  processPayment() {
    const order = this.selectedOrderToPay();
    if (!order) return;

    if (!this.selectedPaymentMethodId) {
      if (this.paymentMethods().length > 0) {
        this.selectedPaymentMethodId = this.paymentMethods()[0].id;
      } else {
        this.notify.warning('Pilih metode pembayaran terlebih dahulu');
        return;
      }
    }

    this.paying.set(true);

    // Call payment API with order_id and payment_method_id
    this.http.post<APIResponse<any>>('/api/v1/payments/pay', {
      order_id: order.id,
      payment_method_id: this.selectedPaymentMethodId
    }).subscribe({
      next: () => {
        this.notify.success('Pembayaran lunas terverifikasi! Pesanan segera diproses gudang.');
        this.paying.set(false);
        this.selectedOrderToPay.set(null);
        this.loadOrders();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal memproses pembayaran');
        this.paying.set(false);
      }
    });
  }

  viewDetails(orderId: string) {
    this.http.get<APIResponse<any>>(`/api/v1/orders/${orderId}`).subscribe(res => {
      if (res.success) {
        this.orderDetail.set(res.data);
      }
    });
  }

  cancelOrder(orderId: string) {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    this.http.post<APIResponse<null>>(`/api/v1/orders/${orderId}/cancel`, {
      reason: 'Dibatalkan oleh pelanggan'
    }).subscribe({
      next: () => {
        this.notify.info('Pesanan berhasil dibatalkan');
        this.loadOrders();
      }
    });
  }
}
