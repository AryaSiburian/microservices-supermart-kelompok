import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { User, UserKYC, ApiResponse } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container users-mgmt-page">
      <div class="page-header">
        <div>
          <span class="badge badge-purple">Super Admin Console</span>
          <h1 class="page-title">Kelola Pengguna & Hak Akses</h1>
          <p class="text-secondary">
            Manajemen data pengguna terdaftar, pengaturan peran operasional (Staf Gudang, Kurir, Customer Service), dan verifikasi identitas legal (KYC).
          </p>
        </div>
        <div class="header-actions">
          <button (click)="openCreateModal()" class="btn btn-primary">
            ➕ Tambah Pengguna Baru
          </button>
          <button (click)="loadAllData()" class="btn btn-outline" [disabled]="loading()">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs mb-6">
        <button 
          (click)="activeTab = 'users'" 
          class="tab-btn" 
          [class.active]="activeTab === 'users'"
        >
          👥 Pengguna & Staf Terdaftar ({{ users().length }})
        </button>
        <button 
          (click)="activeTab = 'kyc'" 
          class="tab-btn" 
          [class.active]="activeTab === 'kyc'"
        >
          🪪 Verifikasi KYC ({{ kycList().length }})
        </button>
      </div>

      <!-- TAB 1: USERS LIST & MANAGEMENT -->
      @if (activeTab === 'users') {
        <div class="card p-0">
          <!-- Role Filters Bar -->
          <div class="p-4 border-b bg-surface-secondary">
            <div class="role-filters">
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'ALL'"
                (click)="selectedRoleFilter = 'ALL'"
              >
                Semua Peran
                <span class="pill-count">{{ users().length }}</span>
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'WAREHOUSE_STAFF'"
                (click)="selectedRoleFilter = 'WAREHOUSE_STAFF'"
              >
                📦 Staf Gudang
                <span class="pill-count">{{ getRoleCount('WAREHOUSE_STAFF') }}</span>
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'COURIER'"
                (click)="selectedRoleFilter = 'COURIER'"
              >
                🚚 Kurir Logistik
                <span class="pill-count">{{ getRoleCount('COURIER') }}</span>
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'CS_AGENT'"
                (click)="selectedRoleFilter = 'CS_AGENT'"
              >
                🎧 Customer Service
                <span class="pill-count">{{ getRoleCount('CS_AGENT') }}</span>
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'CUSTOMER'"
                (click)="selectedRoleFilter = 'CUSTOMER'"
              >
                🛍️ Pelanggan
                <span class="pill-count">{{ getRoleCount('CUSTOMER') }}</span>
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                [class.active]="selectedRoleFilter === 'SUPER_ADMIN'"
                (click)="selectedRoleFilter = 'SUPER_ADMIN'"
              >
                🛡️ Super Admin
                <span class="pill-count">{{ getRoleCount('SUPER_ADMIN') }}</span>
              </button>
            </div>
          </div>

          <!-- Search & Status Filter Bar -->
          <div class="p-4 border-b flex flex-wrap justify-between items-center gap-3">
            <div class="flex items-center gap-3 flex-1 max-w-md">
              <input 
                type="text" 
                [(ngModel)]="searchQuery" 
                placeholder="Cari nama, email, atau no. telepon..." 
                class="form-control"
              />
            </div>
            <div class="flex items-center gap-3">
              <select [(ngModel)]="selectedStatusFilter" class="form-control status-select">
                <option value="ALL">Semua Status Akun</option>
                <option value="ACTIVE">Hanya Aktif</option>
                <option value="INACTIVE">Hanya Nonaktif</option>
              </select>
              <span class="text-sm text-secondary font-medium">
                Ditemukan: <strong>{{ filteredUsers().length }}</strong> pengguna
              </span>
            </div>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat data pengguna...</p>
            </div>
          } @else if (filteredUsers().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p class="text-lg">Tidak ada pengguna yang sesuai dengan filter.</p>
              <button (click)="resetFilters()" class="btn btn-outline btn-sm mt-3">Reset Filter</button>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Pengguna</th>
                    <th>Nomor Telepon</th>
                    <th>Peran (Role)</th>
                    <th>Status Akun</th>
                    <th>Terdaftar Pada</th>
                    <th class="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of filteredUsers(); track u.id) {
                    <tr>
                      <td>
                        <div class="font-semibold text-primary-dark">{{ u.full_name }}</div>
                        <div class="font-mono text-xs text-secondary">{{ u.email }}</div>
                      </td>
                      <td class="text-secondary text-sm">{{ u.phone_number || '-' }}</td>
                      <td>
                        <span class="role-badge" [ngClass]="getRoleClass(u.role)">
                          {{ getRoleLabel(u.role) }}
                        </span>
                      </td>
                      <td>
                        @if (u.is_active) {
                          <span class="badge badge-success">AKTIF</span>
                        } @else {
                          <span class="badge badge-danger">NONAKTIF</span>
                        }
                      </td>
                      <td class="text-secondary text-xs">
                        {{ u.created_at | date:'dd MMM yyyy, HH:mm' }}
                      </td>
                      <td class="text-right">
                        <div class="table-actions">
                          <button 
                            (click)="openEditModal(u)" 
                            class="btn btn-outline btn-sm"
                            title="Edit data dan hak akses pengguna"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            (click)="toggleStatus(u)" 
                            class="btn btn-sm"
                            [class.btn-warning-outline]="u.is_active"
                            [class.btn-success-outline]="!u.is_active"
                            [title]="u.is_active ? 'Nonaktifkan akun pengguna ini' : 'Aktifkan kembali akun ini'"
                          >
                            {{ u.is_active ? '🔒 Nonaktifkan' : '🔓 Aktifkan' }}
                          </button>
                          <button 
                            (click)="deleteUser(u)" 
                            class="btn btn-danger-outline btn-sm"
                            title="Hapus akun pengguna"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- TAB 2: KYC VERIFICATION -->
      @if (activeTab === 'kyc') {
        <div class="card p-0">
          <div class="p-4 border-b">
            <h3 class="font-bold text-lg">Antrean Verifikasi Identitas Nasabah (KYC)</h3>
            <p class="text-sm text-secondary">Persetujuan KYC membuka limit saldo dompet digital dan transaksi grosir.</p>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat antrean KYC...</p>
            </div>
          } @else if (kycList().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Belum ada pengajuan KYC identitas baru.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nama Tertera</th>
                    <th>Nomor KTP/NIK</th>
                    <th>Tanggal Pengajuan</th>
                    <th>Status KYC</th>
                    <th class="text-right">Aksi Verifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  @for (kyc of kycList(); track kyc.id) {
                    <tr>
                      <td class="font-semibold">{{ kyc.full_name }}</td>
                      <td class="font-mono font-bold">{{ kyc.id_card_number }}</td>
                      <td class="text-secondary text-sm">
                        {{ kyc.submitted_at | date:'dd MMM yyyy, HH:mm' }}
                      </td>
                      <td>
                        @switch (kyc.verification_status) {
                          @case ('APPROVED') {
                            <span class="badge badge-success">VERIFIED</span>
                          }
                          @case ('REJECTED') {
                            <span class="badge badge-danger">DITOLAK</span>
                          }
                          @default {
                            <span class="badge badge-warning">MENUNGGU VERIFIKASI</span>
                          }
                        }
                      </td>
                      <td class="text-right">
                        @if (kyc.verification_status === 'PENDING') {
                          <div class="action-btns">
                            <button (click)="verifyKYC(kyc.id, 'APPROVED')" class="btn btn-primary btn-sm">
                              ✅ Setujui
                            </button>
                            <button (click)="verifyKYC(kyc.id, 'REJECTED')" class="btn btn-danger btn-sm">
                              ❌ Tolak
                            </button>
                          </div>
                        } @else {
                          <span class="text-xs text-secondary">Selesai dievaluasi</span>
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

      <!-- MODAL: TAMBAH PENGGUNA BARU -->
      @if (showCreateModal) {
        <div class="modal-backdrop" (click)="closeCreateModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 class="font-bold text-lg">➕ Tambah Pengguna / Staf Baru</h3>
                <p class="text-xs text-secondary">Buat akun staf operasional atau pelanggan baru ke dalam sistem.</p>
              </div>
              <button (click)="closeCreateModal()" class="close-btn">&times;</button>
            </div>
            
            <form (ngSubmit)="submitCreateUser()">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">Nama Lengkap *</label>
                  <input 
                    type="text" 
                    [(ngModel)]="createForm.full_name" 
                    name="full_name" 
                    required 
                    placeholder="Contoh: Budi Santoso" 
                    class="form-control"
                  />
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Alamat Email *</label>
                    <input 
                      type="email" 
                      [(ngModel)]="createForm.email" 
                      name="email" 
                      required 
                      placeholder="budi@nusantara.co.id" 
                      class="form-control"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nomor Telepon</label>
                    <input 
                      type="text" 
                      [(ngModel)]="createForm.phone_number" 
                      name="phone_number" 
                      placeholder="081234567890" 
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Peran / Hak Akses (Role) *</label>
                    <select [(ngModel)]="createForm.role" name="role" required class="form-control font-semibold">
                      <option value="WAREHOUSE_STAFF">📦 Staf Gudang (Warehouse Staff)</option>
                      <option value="COURIER">🚚 Kurir Logistik (Courier)</option>
                      <option value="CS_AGENT">🎧 Customer Service (CS Agent)</option>
                      <option value="CUSTOMER">🛍️ Pelanggan (Customer)</option>
                      <option value="SUPER_ADMIN">🛡️ Administrator (Super Admin)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Kata Sandi (Password) *</label>
                    <input 
                      type="password" 
                      [(ngModel)]="createForm.password" 
                      name="password" 
                      required 
                      minlength="6"
                      placeholder="Minimal 6 karakter" 
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-check mt-2">
                  <label class="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input 
                      type="checkbox" 
                      [(ngModel)]="createForm.is_active" 
                      name="is_active" 
                    />
                    <span>Aktifkan akun ini segera</span>
                  </label>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" (click)="closeCreateModal()" class="btn btn-outline" [disabled]="submitting">
                  Batal
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="submitting">
                  {{ submitting ? 'Menyimpan...' : '💾 Simpan Pengguna' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL: EDIT PENGGUNA -->
      @if (showEditModal) {
        <div class="modal-backdrop" (click)="closeEditModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 class="font-bold text-lg">✏️ Edit Data Pengguna</h3>
                <p class="text-xs text-secondary">Ubah data profil, nomor telepon, dan peran hak akses staf.</p>
              </div>
              <button (click)="closeEditModal()" class="close-btn">&times;</button>
            </div>
            
            <form (ngSubmit)="submitEditUser()">
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">Alamat Email (Akun)</label>
                  <input 
                    type="text" 
                    [value]="editForm.email" 
                    disabled 
                    class="form-control bg-secondary cursor-not-allowed text-secondary"
                  />
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Nama Lengkap *</label>
                    <input 
                      type="text" 
                      [(ngModel)]="editForm.full_name" 
                      name="edit_full_name" 
                      required 
                      class="form-control"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Nomor Telepon</label>
                    <input 
                      type="text" 
                      [(ngModel)]="editForm.phone_number" 
                      name="edit_phone_number" 
                      placeholder="081234567890" 
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label class="form-label">Peran / Hak Akses (Role) *</label>
                    <select [(ngModel)]="editForm.role" name="edit_role" required class="form-control font-semibold">
                      <option value="WAREHOUSE_STAFF">📦 Staf Gudang (Warehouse Staff)</option>
                      <option value="COURIER">🚚 Kurir Logistik (Courier)</option>
                      <option value="CS_AGENT">🎧 Customer Service (CS Agent)</option>
                      <option value="CUSTOMER">🛍️ Pelanggan (Customer)</option>
                      <option value="SUPER_ADMIN">🛡️ Administrator (Super Admin)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Reset Password (Opsional)</label>
                    <input 
                      type="password" 
                      [(ngModel)]="editForm.password" 
                      name="edit_password" 
                      placeholder="Kosongkan bila tidak diubah" 
                      class="form-control"
                    />
                  </div>
                </div>

                <div class="form-check mt-2">
                  <label class="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input 
                      type="checkbox" 
                      [(ngModel)]="editForm.is_active" 
                      name="edit_is_active" 
                    />
                    <span>Status Akun Aktif</span>
                  </label>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" (click)="closeEditModal()" class="btn btn-outline" [disabled]="submitting">
                  Batal
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="submitting">
                  {{ submitting ? 'Menyimpan...' : '💾 Simpan Perubahan' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .users-mgmt-page {
      padding-bottom: 3rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
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
    .role-filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .filter-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      background: var(--bg-surface);
      color: var(--text-primary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .filter-pill:hover {
      border-color: var(--color-primary);
      background: var(--bg-surface-secondary);
    }
    .filter-pill.active {
      background: var(--color-primary);
      color: #ffffff;
      border-color: var(--color-primary);
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);
    }
    .pill-count {
      background: rgba(0, 0, 0, 0.08);
      font-size: 0.75rem;
      padding: 0.1rem 0.45rem;
      border-radius: 9999px;
    }
    .filter-pill.active .pill-count {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }
    .status-select {
      max-width: 180px;
    }
    .role-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-full);
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    .role-super-admin { background: #f3e8ff; color: #7e22ce; }
    .role-warehouse-staff { background: #e0f2fe; color: #0369a1; }
    .role-courier { background: #fef3c7; color: #b45309; }
    .role-cs-agent { background: #dcfce7; color: #15803d; }
    .role-customer { background: #f1f5f9; color: #475569; }

    .table-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.4rem;
    }
    .btn-warning-outline {
      background: transparent;
      border: 1px solid #f59e0b;
      color: #b45309;
    }
    .btn-warning-outline:hover {
      background: #fef3c7;
    }
    .btn-success-outline {
      background: transparent;
      border: 1px solid #10b981;
      color: #047857;
    }
    .btn-success-outline:hover {
      background: #d1fae5;
    }
    .btn-danger-outline {
      background: transparent;
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
    }
    .btn-danger-outline:hover {
      background: var(--color-danger-light);
    }
    .action-btns {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    /* Modal Styling */
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
      max-width: 560px;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border-color);
      overflow: hidden;
      animation: modalSlideIn 0.2s ease-out;
    }
    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
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
      line-height: 1;
    }
    .close-btn:hover {
      color: var(--text-primary);
    }
    .modal-body {
      padding: 1.5rem;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color);
      background: var(--bg-surface-secondary);
    }
    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 640px) {
      .form-grid-2 {
        grid-template-columns: 1fr;
      }
      .page-header {
        flex-direction: column;
      }
    }
    .bg-secondary {
      background-color: var(--bg-surface-secondary);
    }
  `]
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  activeTab: 'users' | 'kyc' = 'users';

  users = signal<User[]>([]);
  kycList = signal<UserKYC[]>([]);
  
  loading = signal(true);
  searchQuery = '';
  selectedRoleFilter = 'ALL';
  selectedStatusFilter = 'ALL';

  // Modal states
  showCreateModal = false;
  showEditModal = false;
  submitting = false;

  // Forms
  createForm = {
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    role: 'WAREHOUSE_STAFF',
    is_active: true
  };

  editForm = {
    id: '',
    email: '',
    full_name: '',
    phone_number: '',
    role: 'WAREHOUSE_STAFF',
    is_active: true,
    password: ''
  };

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.loadUsers();
    this.loadKYC();
  }

  loadUsers() {
    this.http.get<ApiResponse<User[]>>('/api/v1/auth/users')
      .subscribe({
        next: (res) => {
          this.users.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.notify.error('Gagal memuat daftar pengguna');
          this.loading.set(false);
        }
      });
  }

  loadKYC() {
    this.http.get<ApiResponse<UserKYC[]>>('/api/v1/auth/kyc')
      .subscribe({
        next: (res) => {
          this.kycList.set(res.data || []);
        },
        error: (err) => {
          console.error('Failed to load KYC', err);
        }
      });
  }

  filteredUsers(): User[] {
    return this.users().filter(u => {
      // 1. Search Query Filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = u.full_name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesPhone = u.phone_number?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // 2. Role Filter
      if (this.selectedRoleFilter !== 'ALL') {
        const userRole = u.role || 'CUSTOMER';
        if (userRole !== this.selectedRoleFilter) return false;
      }

      // 3. Status Filter
      if (this.selectedStatusFilter === 'ACTIVE' && !u.is_active) return false;
      if (this.selectedStatusFilter === 'INACTIVE' && u.is_active) return false;

      return true;
    });
  }

  getRoleCount(role: string): number {
    return this.users().filter(u => (u.role || 'CUSTOMER') === role).length;
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedRoleFilter = 'ALL';
    this.selectedStatusFilter = 'ALL';
  }

  // CREATE USER
  openCreateModal() {
    this.createForm = {
      full_name: '',
      email: '',
      password: '',
      phone_number: '',
      role: 'WAREHOUSE_STAFF',
      is_active: true
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  submitCreateUser() {
    if (!this.createForm.full_name.trim() || !this.createForm.email.trim() || !this.createForm.password.trim()) {
      this.notify.warning('Nama lengkap, email, dan kata sandi wajib diisi');
      return;
    }

    if (this.createForm.password.length < 6) {
      this.notify.warning('Kata sandi minimal 6 karakter');
      return;
    }

    this.submitting = true;
    const payload = {
      full_name: this.createForm.full_name.trim(),
      email: this.createForm.email.trim(),
      password: this.createForm.password,
      phone_number: this.createForm.phone_number.trim() || null,
      role: this.createForm.role,
      is_active: this.createForm.is_active
    };

    this.http.post<ApiResponse<User>>('/api/v1/auth/users', payload).subscribe({
      next: () => {
        this.notify.success(`Pengguna ${payload.full_name} (${this.getRoleLabel(payload.role)}) berhasil ditambahkan`);
        this.submitting = false;
        this.closeCreateModal();
        this.loadUsers();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err.error?.message || 'Gagal menambahkan pengguna baru');
      }
    });
  }

  // EDIT USER
  openEditModal(user: User) {
    this.editForm = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone_number: user.phone_number || '',
      role: user.role || 'CUSTOMER',
      is_active: user.is_active,
      password: ''
    };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
  }

  submitEditUser() {
    if (!this.editForm.full_name.trim()) {
      this.notify.warning('Nama lengkap wajib diisi');
      return;
    }

    this.submitting = true;
    const payload: any = {
      full_name: this.editForm.full_name.trim(),
      phone_number: this.editForm.phone_number.trim() || null,
      role: this.editForm.role,
      is_active: this.editForm.is_active
    };

    if (this.editForm.password && this.editForm.password.trim().length > 0) {
      if (this.editForm.password.trim().length < 6) {
        this.notify.warning('Kata sandi baru minimal 6 karakter');
        this.submitting = false;
        return;
      }
      payload.password = this.editForm.password.trim();
    }

    this.http.put<ApiResponse<User>>(`/api/v1/auth/users/${this.editForm.id}`, payload).subscribe({
      next: () => {
        this.notify.success('Data pengguna berhasil diperbarui');
        this.submitting = false;
        this.closeEditModal();
        this.loadUsers();
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err.error?.message || 'Gagal memperbarui data pengguna');
      }
    });
  }

  // TOGGLE STATUS
  toggleStatus(user: User) {
    const nextStatus = !user.is_active;
    const actionText = nextStatus ? 'mengaktifkan' : 'menonaktifkan';

    if (!confirm(`Apakah Anda yakin ingin ${actionText} akun "${user.full_name}" (${user.email})?`)) {
      return;
    }

    this.http.put<ApiResponse<any>>(`/api/v1/auth/users/${user.id}/status`, {
      is_active: nextStatus
    }).subscribe({
      next: () => {
        this.notify.success(`Akun ${user.full_name} berhasil di-${actionText}`);
        this.loadUsers();
      },
      error: (err) => {
        this.notify.error(err.error?.message || `Gagal ${actionText} akun pengguna`);
      }
    });
  }

  // DELETE USER
  deleteUser(user: User) {
    if (!confirm(`Peringatan: Apakah Anda yakin ingin menghapus akun "${user.full_name}" (${user.email})?`)) {
      return;
    }

    this.http.delete<ApiResponse<any>>(`/api/v1/auth/users/${user.id}`).subscribe({
      next: () => {
        this.notify.success(`Akun ${user.full_name} berhasil dihapus / dinonaktifkan`);
        this.loadUsers();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal menghapus pengguna');
      }
    });
  }

  // KYC
  verifyKYC(id: string, status: 'APPROVED' | 'REJECTED') {
    this.http.put<ApiResponse<any>>(`/api/v1/auth/kyc/${id}/verify`, {
      status: status
    }).subscribe({
      next: () => {
        this.notify.success(`Status KYC berhasil diubah menjadi ${status}`);
        this.loadKYC();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal mengubah status KYC');
      }
    });
  }

  getRoleClass(role?: string): string {
    switch (role) {
      case 'SUPER_ADMIN': return 'role-super-admin';
      case 'WAREHOUSE_STAFF': return 'role-warehouse-staff';
      case 'COURIER': return 'role-courier';
      case 'CS_AGENT': return 'role-cs-agent';
      default: return 'role-customer';
    }
  }

  getRoleLabel(role?: string): string {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'WAREHOUSE_STAFF': return 'Staf Gudang';
      case 'COURIER': return 'Kurir';
      case 'CS_AGENT': return 'CS Agent';
      case 'CUSTOMER': return 'Pelanggan';
      default: return role || 'Pelanggan';
    }
  }
}
