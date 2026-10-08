import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../../core/services/cart.service';
import { UserAddress, Warehouse, CourierService } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container checkout-page">
      <div class="page-header">
        <h1>Penyelesaian Pesanan (Checkout)</h1>
        <p>Pilih alamat pengiriman, hub gudang pemenuhan, dan metode kurir</p>
      </div>

      <div class="checkout-grid">
        <div class="checkout-form-area">
          <!-- Step 1: Alamat Pengiriman -->
          <div class="card checkout-card">
            <div class="card-title">
              <span class="step-num">1</span>
              <h3>Alamat Pengiriman</h3>
            </div>

            @if (addresses().length === 0) {
              <div class="empty-prompt">
                <p>Belum ada alamat pengiriman tersimpan.</p>
                <div class="new-address-form">
                  <div class="form-group">
                    <label class="form-label">Label Alamat</label>
                    <input type="text" class="form-control" [(ngModel)]="newAddress.address_label" placeholder="Rumah / Kantor" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nama Penerima</label>
                    <input type="text" class="form-control" [(ngModel)]="newAddress.recipient_name" placeholder="Nama lengkap penerima" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nomor Telepon</label>
                    <input type="tel" class="form-control" [(ngModel)]="newAddress.phone_number" placeholder="08xxxxxxxx" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Alamat Lengkap</label>
                    <textarea class="form-control" [(ngModel)]="newAddress.street_address" rows="2" placeholder="Nama jalan, nomor rumah, RT/RW"></textarea>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">Kota</label>
                      <input type="text" class="form-control" [(ngModel)]="newAddress.city" placeholder="Denpasar / Jakarta" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Provinsi</label>
                      <input type="text" class="form-control" [(ngModel)]="newAddress.province" placeholder="Bali / DKI Jakarta" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Kode Pos</label>
                      <input type="text" class="form-control" [(ngModel)]="newAddress.postal_code" placeholder="80239" />
                    </div>
                  </div>
                  <button (click)="saveAddress()" class="btn btn-primary btn-sm" id="btn-save-addr">Simpan Alamat</button>
                </div>
              </div>
            } @else {
              <div class="address-options">
                @for (addr of addresses(); track addr.id) {
                  <label class="address-card" [class.selected]="selectedAddressId === addr.id">
                    <input
                      type="radio"
                      name="shippingAddress"
                      [value]="addr.id"
                      [(ngModel)]="selectedAddressId"
                    />
                    <div class="addr-info">
                      <div class="addr-header">
                        <strong class="addr-label">{{ addr.address_label }}</strong>
                        @if (addr.is_primary) {
                          <span class="badge badge-primary">Utama</span>
                        }
                      </div>
                      <span class="addr-recipient">{{ addr.recipient_name }} ({{ addr.phone_number }})</span>
                      <p class="addr-street">{{ addr.street_address }}, {{ addr.city }}, {{ addr.province }} {{ addr.postal_code }}</p>
                    </div>
                  </label>
                }
              </div>
            }
          </div>

          <!-- Step 2: Gudang Pengiriman (Fulfillment Hub) -->
          <div class="card checkout-card">
            <div class="card-title">
              <span class="step-num">2</span>
              <h3>Hub Gudang Pemenuhan (Warehouse)</h3>
            </div>
            <p class="section-desc">Pilih cabang gudang Nusantara SuperMart terdekat dari lokasi Anda:</p>
            <div class="options-grid">
              @for (wh of warehouses(); track wh.id) {
                <label class="option-card" [class.selected]="selectedWarehouseId === wh.id">
                  <input type="radio" name="warehouse" [value]="wh.id" [(ngModel)]="selectedWarehouseId" />
                  <div>
                    <strong class="option-title">{{ wh.warehouse_name }}</strong>
                    <span class="option-sub">{{ wh.city }} • {{ wh.address }}</span>
                  </div>
                </label>
              }
            </div>
          </div>

          <!-- Step 3: Kurir Logistik -->
          <div class="card checkout-card">
            <div class="card-title">
              <span class="step-num">3</span>
              <h3>Layanan Pengiriman Logistik</h3>
            </div>
            <div class="options-grid">
              <label class="option-card" [class.selected]="selectedCourier === 'GoSend Instant Fulfillment'">
                <input type="radio" name="courier" value="GoSend Instant Fulfillment" [(ngModel)]="selectedCourier" />
                <div>
                  <strong class="option-title">GoSend Instant Fulfillment</strong>
                  <span class="option-sub">Estimasi 1-3 Jam • Rp 15.000</span>
                </div>
              </label>

              <label class="option-card" [class.selected]="selectedCourier === 'JNE Reguler'">
                <input type="radio" name="courier" value="JNE Reguler" [(ngModel)]="selectedCourier" />
                <div>
                  <strong class="option-title">JNE Reguler (Hub Antar Kota)</strong>
                  <span class="option-sub">Estimasi 2-3 Hari • Rp 12.000</span>
                </div>
              </label>

              <label class="option-card" [class.selected]="selectedCourier === 'Nusantara Internal Express'">
                <input type="radio" name="courier" value="Nusantara Internal Express" [(ngModel)]="selectedCourier" />
                <div>
                  <strong class="option-title">Nusantara Express Same-Day</strong>
                  <span class="option-sub">Armada Internal • Rp 18.000</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Right Side: Order Summary -->
        <div class="checkout-summary">
          <div class="card summary-card">
            <h3>Ringkasan Pembayaran</h3>

            <div class="summary-items-preview">
              @for (item of cartService.cart()?.items; track item.id) {
                <div class="preview-item">
                  <span class="p-title">{{ item.quantity }}x {{ item.product_title }}</span>
                  <span class="p-price">Rp {{ item.subtotal | number:'1.0-0' }}</span>
                </div>
              }
            </div>

            <div class="summary-divider"></div>

            <div class="summary-lines">
              <div class="summary-row">
                <span>Subtotal Barang</span>
                <span>Rp {{ cartService.totalAmount() | number:'1.0-0' }}</span>
              </div>

              @if (voucherDiscount > 0) {
                <div class="summary-row discount-row">
                  <span>Diskon Voucher</span>
                  <span>- Rp {{ voucherDiscount | number:'1.0-0' }}</span>
                </div>
              }

              <div class="summary-row">
                <span>PPN (11%)</span>
                <span>Rp {{ getTax() | number:'1.0-0' }}</span>
              </div>

              <div class="summary-row">
                <span>Ongkos Kirim</span>
                <span>Rp {{ getShippingFee() | number:'1.0-0' }}</span>
              </div>

              <div class="summary-divider"></div>

              <div class="summary-row total-row">
                <span>Total Tagihan</span>
                <span class="grand-total">Rp {{ getGrandTotal() | number:'1.0-0' }}</span>
              </div>
            </div>

            <button
              (click)="placeOrder()"
              class="btn btn-primary btn-lg submit-order-btn"
              id="btn-place-order"
              [disabled]="loading() || !selectedAddressId || !selectedWarehouseId"
            >
              @if (loading()) {
                <span>Membuat Pesanan...</span>
              } @else {
                <span>Bayar Sekarang (Rp {{ getGrandTotal() | number:'1.0-0' }}) →</span>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkout-page {
      padding-bottom: 3rem;
    }
    .page-header {
      margin-bottom: 2rem;
    }
    .page-header h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    .page-header p {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .checkout-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 1.5rem;
      align-items: start;
    }
    @media (max-width: 900px) {
      .checkout-grid {
        grid-template-columns: 1fr;
      }
    }
    .checkout-card {
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .step-num {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      background: var(--color-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 800;
    }
    .card-title h3 {
      font-size: 1.125rem;
      font-weight: 700;
    }
    .section-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }
    .address-options, .options-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .address-card, .option-card {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: white;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .address-card:hover, .option-card:hover {
      background: var(--bg-surface-secondary);
    }
    .address-card.selected, .option-card.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-light);
    }
    .addr-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .addr-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .addr-recipient {
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .addr-street {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .option-title {
      display: block;
      font-size: 0.875rem;
      color: var(--text-primary);
    }
    .option-sub {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .form-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }
    .summary-card {
      padding: 1.5rem;
    }
    .summary-card h3 {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .summary-items-preview {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 180px;
      overflow-y: auto;
    }
    .preview-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .summary-divider {
      height: 1px;
      background: var(--border-color);
      margin: 1rem 0;
    }
    .summary-lines {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      font-size: 0.875rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      color: var(--text-secondary);
    }
    .discount-row {
      color: var(--color-secondary-hover);
      font-weight: 600;
    }
    .total-row {
      color: var(--text-primary);
      font-weight: 700;
      font-size: 1.125rem;
    }
    .grand-total {
      color: var(--color-primary-dark);
      font-weight: 800;
    }
    .submit-order-btn {
      width: 100%;
      margin-top: 1.5rem;
    }
  `]
})
export class CheckoutComponent implements OnInit {
  cartService = inject(CartService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  addresses = signal<UserAddress[]>([]);
  warehouses = signal<Warehouse[]>([]);
  loading = signal(false);

  selectedAddressId = '';
  selectedWarehouseId = '';
  selectedCourier = 'GoSend Instant Fulfillment';
  voucherCode = '';
  voucherDiscount = 0;

  newAddress = {
    address_label: 'Rumah',
    recipient_name: '',
    phone_number: '',
    street_address: '',
    city: 'Denpasar',
    province: 'Bali',
    postal_code: '80239',
    is_primary: true
  };

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['voucher']) {
        this.voucherCode = params['voucher'];
        this.voucherDiscount = 20000;
      }
    });

    this.loadAddresses();
    this.loadWarehouses();
  }

  loadAddresses() {
    this.http.get<APIResponse<UserAddress[]>>('/api/v1/auth/addresses').subscribe(res => {
      if (res.success && res.data) {
        this.addresses.set(res.data);
        if (res.data.length > 0) {
          const primary = res.data.find(a => a.is_primary) || res.data[0];
          this.selectedAddressId = primary.id;
        }
      }
    });
  }

  loadWarehouses() {
    this.http.get<APIResponse<Warehouse[]>>('/api/v1/inventory/warehouses').subscribe(res => {
      if (res.success && res.data) {
        this.warehouses.set(res.data);
        if (res.data.length > 0) {
          this.selectedWarehouseId = res.data[0].id;
        }
      }
    });
  }

  saveAddress() {
    if (!this.newAddress.recipient_name || !this.newAddress.street_address) {
      this.notify.error('Lengkapi nama dan alamat');
      return;
    }
    this.http.post<APIResponse<null>>('/api/v1/auth/addresses', this.newAddress).subscribe(res => {
      if (res.success) {
        this.notify.success('Alamat berhasil disimpan');
        this.loadAddresses();
      }
    });
  }

  getShippingFee(): number {
    if (this.selectedCourier.includes('JNE')) return 12000;
    if (this.selectedCourier.includes('Internal')) return 18000;
    return 15000;
  }

  getTax(): number {
    const net = Math.max(0, this.cartService.totalAmount() - this.voucherDiscount);
    return net * 0.11;
  }

  getGrandTotal(): number {
    const net = Math.max(0, this.cartService.totalAmount() - this.voucherDiscount);
    return net + this.getTax() + this.getShippingFee();
  }

  placeOrder() {
    if (!this.selectedAddressId || !this.selectedWarehouseId) {
      this.notify.error('Pilih alamat dan gudang pemenuhan');
      return;
    }

    this.loading.set(true);
    this.cartService.checkout({
      shipping_address_id: this.selectedAddressId,
      warehouse_id: this.selectedWarehouseId,
      courier_name: this.selectedCourier,
      voucher_code: this.voucherCode || undefined
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/orders']);
      },
      error: () => this.loading.set(false)
    });
  }
}
