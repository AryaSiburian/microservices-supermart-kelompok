import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { Cart, CartItem, Order } from '../models/types';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';

interface APIResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);

  cart = signal<Cart | null>(null);
  loading = signal<boolean>(false);

  itemCount = computed(() => {
    const items = this.cart()?.items || [];
    return items.reduce((sum, item) => sum + item.quantity, 0);
  });

  totalAmount = computed(() => {
    const items = this.cart()?.items || [];
    return items.reduce((sum, item) => sum + (item.quantity * item.product_price), 0);
  });

  constructor() {
    if (this.auth.isLoggedIn() && this.auth.userRole() === 'CUSTOMER') {
      this.loadCart().subscribe();
    }
  }

  loadCart(): Observable<APIResponse<Cart | null>> {
    if (!this.auth.isLoggedIn() || this.auth.userRole() !== 'CUSTOMER') {
      this.cart.set(null);
      return of({ success: true, data: null });
    }

    this.loading.set(true);
    return this.http.get<APIResponse<Cart>>('/api/v1/orders/cart').pipe(
      tap(res => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.cart.set(res.data);
        } else {
          this.cart.set(null);
        }
      }),
      catchError(err => {
        this.loading.set(false);
        this.cart.set(null);
        return throwError(() => err);
      })
    );
  }

  addToCart(productId: string, quantity: number = 1): Observable<APIResponse<null>> {
    if (!this.auth.isLoggedIn()) {
      this.notify.warning('Silakan masuk (login) terlebih dahulu untuk menambahkan barang ke keranjang.');
      this.router.navigate(['/auth/login']);
      return throwError(() => new Error('Unauthenticated'));
    }

    if (this.auth.userRole() !== 'CUSTOMER') {
      this.notify.warning('Hanya akun Pelanggan yang dapat berbelanja dan menambah produk ke keranjang.');
      return throwError(() => new Error('Forbidden'));
    }

    return this.http.post<APIResponse<null>>('/api/v1/orders/cart', { product_id: productId, quantity }).pipe(
      tap(res => {
        if (res.success) {
          this.notify.success('Produk berhasil ditambahkan ke keranjang');
          this.loadCart().subscribe();
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Gagal menambahkan produk ke keranjang';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }

  updateQuantity(itemId: string, quantity: number): Observable<APIResponse<null>> {
    if (quantity <= 0) {
      return this.removeItem(itemId);
    }

    return this.http.put<APIResponse<null>>(`/api/v1/orders/cart/${itemId}`, { quantity }).pipe(
      tap(res => {
        if (res.success) {
          this.loadCart().subscribe();
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Gagal mengubah jumlah barang';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }

  removeItem(itemId: string): Observable<APIResponse<null>> {
    return this.http.delete<APIResponse<null>>(`/api/v1/orders/cart/${itemId}`).pipe(
      tap(res => {
        if (res.success) {
          this.notify.info('Item dihapus dari keranjang');
          this.loadCart().subscribe();
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Gagal menghapus item';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }

  checkout(payload: {
    shipping_address_id: string;
    warehouse_id: string;
    courier_name: string;
    voucher_code?: string;
  }): Observable<APIResponse<Order>> {
    return this.http.post<APIResponse<Order>>('/api/v1/orders/checkout', payload).pipe(
      tap(res => {
        if (res.success) {
          this.notify.success('Pesanan berhasil dibuat!');
          this.cart.set(null);
        }
      }),
      catchError(err => {
        const msg = err.error?.message || 'Gagal memproses checkout';
        this.notify.error(msg);
        return throwError(() => err);
      })
    );
  }
}
