import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

interface VoucherValidationResponse {
  valid: boolean;
  voucher_code: string;
  discount_amount: number;
  message: string;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container cart-page">
      <div class="page-header">
        <h1>Keranjang Belanja</h1>
        <p>Periksa kembali produk pilihan Anda sebelum checkout</p>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-cart card">
          <span class="empty-icon">🔒</span>
          <h3>Silakan Masuk ke Akun Anda</h3>
          <p>Masuk untuk melihat isi keranjang belanja atau melanjutkan ke proses checkout.</p>
          <a routerLink="/auth/login" class="btn btn-primary mt-4" id="btn-login-cart">Masuk / Login Sekarang</a>
        </div>
      } @else if (auth.userRole() !== 'CUSTOMER') {
        <div class="empty-cart card">
          <span class="empty-icon">🚫</span>
          <h3>Akses Belanja Khusus Pelanggan</h3>
          <p>Akun Anda saat ini masuk sebagai <strong>{{ auth.userRole() }}</strong>. Fitur belanja hanya tersedia untuk akun Pelanggan (Customer).</p>
          <div class="mt-4 flex gap-3 justify-center" style="display: flex; gap: 0.75rem; justify-content: center;">
            <button (click)="auth.redirectBasedOnRole(auth.userRole())" class="btn btn-primary">
              Kembali ke Dashboard
            </button>
            <button (click)="auth.logout()" class="btn btn-outline">
              Ganti Akun
            </button>
          </div>
        </div>
      } @else if (cartService.loading()) {
        <div class="empty-cart card">
          <span class="empty-icon">⏳</span>
          <h3>Memuat keranjang belanja...</h3>
        </div>
      } @else if (!cartService.cart() || (cartService.cart()?.items?.length || 0) === 0) {
        <div class="empty-cart card">
          <span class="empty-icon">🛒</span>
          <h3>Keranjang Anda masih kosong</h3>
          <p>Temukan beras berkualitas, kopi kintamani, dan kebutuhan harian lainnya di katalog.</p>
          <a routerLink="/catalog" class="btn btn-primary" id="btn-shop-now">Mulai Belanja Sekarang</a>
        </div>
      } @else {
        <div class="cart-layout">
          <!-- Items List -->
          <div class="cart-items-section card">
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Harga Satuan</th>
                    <th>Jumlah</th>
                    <th>Subtotal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of cartService.cart()?.items; track item.id) {
                    <tr>
                      <td class="product-cell">
                        <img 
                          [src]="item.image_url || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500'" 
                          [alt]="item.product_title" 
                          class="item-thumb" 
                        />
                        <div>
                          <strong class="item-title">{{ item.product_title }}</strong>
                          <span class="item-sku">SKU: {{ item.product_sku }}</span>
                        </div>
                      </td>
                      <td>Rp {{ item.product_price | number:'1.0-0' }}</td>
                      <td>
                        <div class="qty-stepper">
                          <button
                            (click)="changeQty(item.id, item.quantity - 1)"
                            class="qty-btn"
                            [disabled]="item.quantity <= 1"
                          >
                            -
                          </button>
                          <span class="qty-val">{{ item.quantity }}</span>
                          <button
                            (click)="changeQty(item.id, item.quantity + 1)"
                            class="qty-btn"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>Rp {{ item.subtotal | number:'1.0-0' }}</strong>
                      </td>
                      <td>
                        <button
                          (click)="cartService.removeItem(item.id).subscribe()"
                          class="btn-delete"
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary Section -->
          <div class="summary-section">
            <div class="card summary-card">
              <h3>Ringkasan Pesanan</h3>

              <div class="voucher-box">
                <label class="form-label" for="voucher">Punya Kode Voucher?</label>
                <div class="voucher-input-group">
                  <input
                    type="text"
                    id="voucher"
                    class="form-control"
                    placeholder="misal: BALISEHAT20"
                    [(ngModel)]="voucherCode"
                  />
                  <button (click)="applyVoucher()" class="btn btn-outline btn-sm" id="btn-apply-voucher">
                    Terapkan
                  </button>
                </div>
              </div>

              <div class="summary-rows">
                <div class="summary-row">
                  <span>Total Harga ({{ cartService.itemCount() }} barang)</span>
                  <span>Rp {{ cartService.totalAmount() | number:'1.0-0' }}</span>
                </div>

                @if (appliedDiscount() > 0) {
                  <div class="summary-row discount-row">
                    <span>Diskon Voucher</span>
                    <span>- Rp {{ appliedDiscount() | number:'1.0-0' }}</span>
                  </div>
                }

                <div class="summary-row">
                  <span>Estimasi Ongkos Kirim</span>
                  <span>Rp 15.000</span>
                </div>

                <div class="summary-row">
                  <span>PPN (11%)</span>
                  <span>Rp {{ getTax() | number:'1.0-0' }}</span>
                </div>

                <div class="summary-divider"></div>

                <div class="summary-row total-row">
                  <span>Total Tagihan</span>
                  <span class="grand-total">Rp {{ getGrandTotal() | number:'1.0-0' }}</span>
                </div>
              </div>

              <button
                (click)="goToCheckout()"
                class="btn btn-primary checkout-btn"
                id="btn-checkout"
              >
                Lanjut ke Pembayaran ➔
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .cart-page {
      padding-bottom: 3rem;
    }
    .page-header {
      margin-bottom: 2rem;
    }
    .page-header h1 {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }
    .page-header p {
      color: var(--text-secondary);
    }
    .empty-cart {
      text-align: center;
      padding: 4rem 2rem;
      max-width: 500px;
      margin: 0 auto;
    }
    .empty-icon {
      font-size: 4rem;
      display: inline-block;
      margin-bottom: 1.5rem;
    }
    .empty-cart h3 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.75rem;
    }
    .empty-cart p {
      color: var(--text-secondary);
      margin-bottom: 2rem;
    }
    .cart-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 2rem;
      align-items: start;
    }
    @media (max-width: 968px) {
      .cart-layout {
        grid-template-columns: 1fr;
      }
    }
    .table-container {
      overflow-x: auto;
    }
    .product-cell {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .item-thumb {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-md);
      object-fit: cover;
      border: 1px solid var(--border-color);
    }
    .item-title {
      display: block;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }
    .item-sku {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: monospace;
    }
    .qty-stepper {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .qty-btn {
      background: var(--bg-surface-secondary);
      border: none;
      padding: 0.25rem 0.75rem;
      font-size: 1rem;
      cursor: pointer;
      color: var(--text-primary);
    }
    .qty-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .qty-val {
      padding: 0.25rem 0.75rem;
      font-weight: 600;
      min-width: 32px;
      text-align: center;
    }
    .btn-delete {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      opacity: 0.7;
      transition: opacity var(--transition-fast);
    }
    .btn-delete:hover {
      opacity: 1;
    }
    .summary-card {
      position: sticky;
      top: 5rem;
    }
    .summary-card h3 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border-color);
    }
    .voucher-box {
      margin-bottom: 1.5rem;
    }
    .voucher-input-group {
      display: flex;
      gap: 0.5rem;
    }
    .summary-rows {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
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
    .summary-divider {
      height: 1px;
      background: var(--border-color);
      margin: 0.5rem 0;
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
    .checkout-btn {
      width: 100%;
      margin-top: 1.5rem;
    }
  `]
})
export class CartComponent implements OnInit {
  cartService = inject(CartService);
  auth = inject(AuthService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private router = inject(Router);

  voucherCode = '';
  appliedDiscount = signal(0);

  ngOnInit() {
    if (this.auth.isLoggedIn() && this.auth.userRole() === 'CUSTOMER') {
      this.cartService.loadCart().subscribe();
    }
  }

  changeQty(itemId: string, newQty: number) {
    if (newQty <= 0) return;
    this.cartService.updateQuantity(itemId, newQty).subscribe();
  }

  applyVoucher() {
    if (!this.voucherCode) return;
    this.http.post<APIResponse<VoucherValidationResponse>>('/api/v1/promotions/vouchers/validate', {
      voucher_code: this.voucherCode,
      subtotal: this.cartService.totalAmount()
    }).subscribe({
      next: res => {
        if (res.success && res.data.valid) {
          this.appliedDiscount.set(res.data.discount_amount);
          this.notify.success(res.data.message);
        } else {
          this.appliedDiscount.set(0);
          this.notify.error(res.data?.message || 'Voucher tidak valid');
        }
      },
      error: () => this.notify.error('Gagal memverifikasi voucher')
    });
  }

  getTax(): number {
    const net = Math.max(0, this.cartService.totalAmount() - this.appliedDiscount());
    return net * 0.11;
  }

  getGrandTotal(): number {
    const net = Math.max(0, this.cartService.totalAmount() - this.appliedDiscount());
    return net + this.getTax() + 15000;
  }

  goToCheckout() {
    this.router.navigate(['/checkout'], {
      queryParams: { voucher: this.voucherCode }
    });
  }
}
