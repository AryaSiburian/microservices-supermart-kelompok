import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CustomerTicket, TicketMessage, ApiResponse } from '../../../core/models/types';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-agent-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container cs-page">
      <div class="page-header">
        <div>
          <span class="badge badge-success">Customer Service Helpdesk</span>
          <h1 class="page-title">Antrean Tiket & Layanan Bantuan CS</h1>
          <p class="text-secondary">Eskalasi pengaduan, bantuan pelanggan langsung, dan resolusi kendala pesanan.</p>
        </div>
        <div class="header-actions">
          <button (click)="loadTickets()" class="btn btn-outline" [disabled]="loading()">
            🔄 Refresh Antrean
          </button>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="stats-grid mb-6">
        <div class="card stat-card">
          <div class="stat-icon bg-info-subtle">📬</div>
          <div class="stat-content">
            <span class="stat-label">Total Tiket Masuk</span>
            <span class="stat-value">{{ tickets().length }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-warning-subtle">⏳</div>
          <div class="stat-content">
            <span class="stat-label">Perlu Respons (Open)</span>
            <span class="stat-value text-warning">{{ countOpen() }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-primary-subtle">💬</div>
          <div class="stat-content">
            <span class="stat-label">Sedang Diproses (In Progress)</span>
            <span class="stat-value text-primary">{{ countInProgress() }}</span>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-success-subtle">✅</div>
          <div class="stat-content">
            <span class="stat-label">Terselesaikan (Resolved)</span>
            <span class="stat-value text-success">{{ countResolved() }}</span>
          </div>
        </div>
      </div>

      <div class="cs-layout">
        <!-- Tickets Queue List -->
        <div class="card p-0 ticket-list-card">
          <div class="p-4 border-b flex justify-between items-center">
            <h3 class="font-bold">Daftar Antrean Tiket</h3>
            <div class="filter-pills">
              <button 
                (click)="filterStatus = 'ALL'" 
                class="pill-btn" 
                [class.active]="filterStatus === 'ALL'"
              >
                Semua
              </button>
              <button 
                (click)="filterStatus = 'OPEN'" 
                class="pill-btn" 
                [class.active]="filterStatus === 'OPEN'"
              >
                Open
              </button>
              <button 
                (click)="filterStatus = 'IN_PROGRESS'" 
                class="pill-btn" 
                [class.active]="filterStatus === 'IN_PROGRESS'"
              >
                Diproses
              </button>
            </div>
          </div>

          @if (loading()) {
            <div class="p-8 text-center">
              <div class="spinner"></div>
              <p class="mt-2 text-secondary">Memuat antrean tiket...</p>
            </div>
          } @else if (filteredTickets().length === 0) {
            <div class="p-8 text-center text-secondary">
              <p>Tidak ada tiket pada kategori ini.</p>
            </div>
          } @else {
            <div class="ticket-items">
              @for (t of filteredTickets(); track t.id) {
                <div 
                  class="ticket-item" 
                  [class.active]="selectedTicket()?.id === t.id"
                  (click)="selectTicket(t)"
                >
                  <div class="ticket-header-row">
                    <span class="ticket-code font-mono font-bold">{{ t.ticket_code }}</span>
                    <span class="badge badge-sm" [ngClass]="getPriorityBadgeClass(t.priority)">
                      {{ t.priority }}
                    </span>
                  </div>
                  <h4 class="ticket-subject">{{ t.subject }}</h4>
                  <div class="ticket-meta">
                    <span>👤 {{ t.customer_name || 'Pelanggan' }}</span>
                    <span>🕒 {{ t.created_at | date:'dd MMM, HH:mm' }}</span>
                  </div>
                  <div class="ticket-footer-row mt-2">
                    <span class="badge" [ngClass]="getStatusBadgeClass(t.status)">
                      {{ t.status }}
                    </span>
                    @if (t.agent_name) {
                      <span class="agent-tag">🎧 {{ t.agent_name }}</span>
                    } @else {
                      <span class="unassigned-tag">Belum Di-assign</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Ticket Conversation & Action Panel -->
        <div class="card p-0 ticket-detail-card">
          @if (selectedTicket()) {
            <div class="p-4 border-b flex justify-between items-center bg-surface-secondary">
              <div>
                <span class="text-xs font-mono text-secondary">TIKET #{{ selectedTicket()?.ticket_code }}</span>
                <h3 class="font-bold text-lg">{{ selectedTicket()?.subject }}</h3>
                <p class="text-xs text-secondary">
                  Pelanggan: <strong>{{ selectedTicket()?.customer_name }}</strong> • 
                  Kategori: <strong>{{ selectedTicket()?.category_name || 'Umum' }}</strong>
                </p>
              </div>
              <div class="ticket-actions">
                <select 
                  [ngModel]="selectedTicket()?.status" 
                  (ngModelChange)="changeStatus($event)"
                  class="form-control form-control-sm"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>

                @if (!selectedTicket()?.agent_name) {
                  <button (click)="assignToMe()" class="btn btn-primary btn-sm ml-2">
                    Ambil Tiket
                  </button>
                }
              </div>
            </div>

            <!-- Messages Thread -->
            <div class="messages-container p-4">
              @if (loadingMessages()) {
                <div class="text-center p-4">
                  <div class="spinner"></div>
                </div>
              } @else if (messages().length === 0) {
                <div class="text-center text-secondary p-4">
                  <p>Belum ada riwayat pesan dalam tiket ini.</p>
                </div>
              } @else {
                <div class="message-thread">
                  @for (msg of messages(); track msg.id) {
                    <div 
                      class="chat-bubble" 
                      [class.agent-bubble]="msg.sender_role !== 'CUSTOMER'"
                      [class.customer-bubble]="msg.sender_role === 'CUSTOMER'"
                    >
                      <div class="bubble-header">
                        <span class="sender-name font-semibold">
                          {{ msg.sender_name || (msg.sender_role === 'CUSTOMER' ? 'Pelanggan' : 'CS Agent') }}
                        </span>
                        <span class="msg-time">{{ msg.sent_at | date:'HH:mm' }}</span>
                      </div>
                      <div class="bubble-body">
                        {{ msg.message_body }}
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Reply Box -->
            <div class="p-4 border-t bg-surface-secondary">
              <form (ngSubmit)="sendReply()" class="reply-form">
                <textarea 
                  [(ngModel)]="replyBody" 
                  name="replyBody"
                  placeholder="Ketik respon resmi Customer Service untuk pelanggan..." 
                  rows="3"
                  class="form-control"
                  required
                ></textarea>
                <div class="flex justify-between items-center mt-2">
                  <small class="text-secondary">Respon akan langsung terbaca oleh pelanggan di portal bantuan.</small>
                  <button type="submit" class="btn btn-primary btn-sm" [disabled]="submittingReply() || !replyBody.trim()">
                    @if (submittingReply()) { Mengirim... } @else { 💬 Kirim Tanggapan }
                  </button>
                </div>
              </form>
            </div>
          } @else {
            <div class="empty-detail p-12 text-center text-secondary">
              <span class="text-4xl mb-2">👈</span>
              <h3 class="font-bold text-lg">Pilih Tiket dari Antrean</h3>
              <p>Pilih salah satu tiket di sebelah kiri untuk melihat pesan percakapan dan memberikan respon bantuan.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cs-page {
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
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
    }
    .stat-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }
    .bg-info-subtle { background: #e0f2fe; }
    .bg-warning-subtle { background: #fef3c7; }
    .bg-primary-subtle { background: #e0e7ff; }
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
    .cs-layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 1.5rem;
      min-height: 600px;
    }
    .ticket-list-card {
      display: flex;
      flex-direction: column;
      height: 650px;
    }
    .filter-pills {
      display: flex;
      gap: 0.25rem;
    }
    .pill-btn {
      padding: 0.25rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-full);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .pill-btn.active {
      background: var(--color-primary);
      color: white;
      border-color: var(--color-primary);
    }
    .ticket-items {
      overflow-y: auto;
      flex: 1;
    }
    .ticket-item {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .ticket-item:hover {
      background: var(--bg-surface-secondary);
    }
    .ticket-item.active {
      background: #eef2ff;
      border-left: 4px solid var(--color-primary);
    }
    .ticket-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }
    .ticket-code {
      font-size: 0.75rem;
      color: var(--color-primary-dark);
    }
    .ticket-subject {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0.25rem 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ticket-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    .ticket-footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .agent-tag {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #0369a1;
      background: #e0f2fe;
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-sm);
    }
    .unassigned-tag {
      font-size: 0.6875rem;
      color: var(--text-muted);
      font-style: italic;
    }
    .ticket-detail-card {
      display: flex;
      flex-direction: column;
      height: 650px;
    }
    .messages-container {
      flex: 1;
      overflow-y: auto;
      background: #fafafa;
    }
    .message-thread {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .chat-bubble {
      max-width: 80%;
      padding: 0.875rem 1rem;
      border-radius: var(--radius-lg);
      font-size: 0.875rem;
    }
    .agent-bubble {
      align-self: flex-end;
      background: var(--color-primary-light);
      color: var(--color-primary-dark);
      border-bottom-right-radius: 2px;
    }
    .customer-bubble {
      align-self: flex-start;
      background: white;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-bottom-left-radius: 2px;
    }
    .bubble-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.375rem;
      font-size: 0.75rem;
      opacity: 0.85;
    }
    .empty-detail {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
  `]
})
export class SupportAgentTicketsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  tickets = signal<CustomerTicket[]>([]);
  messages = signal<TicketMessage[]>([]);
  
  loading = signal(true);
  loadingMessages = signal(false);
  submittingReply = signal(false);

  filterStatus = 'ALL';
  selectedTicket = signal<CustomerTicket | null>(null);
  replyBody = '';

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading.set(true);
    this.http.get<ApiResponse<CustomerTicket[]>>('/api/v1/support/tickets')
      .subscribe({
        next: (res) => {
          this.tickets.set(res.data || []);
          this.loading.set(false);
          // Re-select active ticket if open
          const current = this.selectedTicket();
          if (current) {
            const updated = (res.data || []).find((t: CustomerTicket) => t.id === current.id);
            if (updated) this.selectedTicket.set(updated);
          }
        },
        error: (err) => {
          this.notify.error('Gagal memuat antrean tiket');
          this.loading.set(false);
        }
      });
  }

  filteredTickets(): CustomerTicket[] {
    if (this.filterStatus === 'ALL') return this.tickets();
    return this.tickets().filter(t => t.status === this.filterStatus);
  }

  countOpen(): number {
    return this.tickets().filter(t => t.status === 'OPEN').length;
  }

  countInProgress(): number {
    return this.tickets().filter(t => t.status === 'IN_PROGRESS').length;
  }

  countResolved(): number {
    return this.tickets().filter(t => t.status === 'RESOLVED').length;
  }

  selectTicket(ticket: CustomerTicket) {
    this.selectedTicket.set(ticket);
    this.loadMessages(ticket.id);
  }

  loadMessages(ticketId: string) {
    this.loadingMessages.set(true);
    this.http.get<ApiResponse<any>>(`/api/v1/support/tickets/${ticketId}`)
      .subscribe({
        next: (res) => {
          if (res.data && res.data.messages) {
            this.messages.set(res.data.messages);
          } else {
            this.messages.set([]);
          }
          this.loadingMessages.set(false);
        },
        error: (err) => {
          this.messages.set([]);
          this.loadingMessages.set(false);
        }
      });
  }

  assignToMe() {
    const ticket = this.selectedTicket();
    const user = this.auth.currentUser();
    if (!ticket || !user) return;

    this.http.put<ApiResponse<any>>(`/api/v1/support/tickets/${ticket.id}/assign`, {
      agent_id: user.id
    }).subscribe({
      next: () => {
        this.notify.success('Tiket berhasil ditugaskan ke Anda');
        this.loadTickets();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal menugaskan tiket');
      }
    });
  }

  changeStatus(newStatus: string) {
    const ticket = this.selectedTicket();
    if (!ticket) return;

    this.http.put<ApiResponse<any>>(`/api/v1/support/tickets/${ticket.id}/status`, {
      status: newStatus
    }).subscribe({
      next: () => {
        this.notify.success(`Status tiket diubah menjadi ${newStatus}`);
        this.loadTickets();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal mengubah status tiket');
      }
    });
  }

  sendReply() {
    const ticket = this.selectedTicket();
    if (!ticket || !this.replyBody.trim()) return;

    this.submittingReply.set(true);
    this.http.post<ApiResponse<any>>(`/api/v1/support/tickets/${ticket.id}/messages`, {
      message_body: this.replyBody.trim()
    }).subscribe({
      next: () => {
        this.notify.success('Tanggapan berhasil dikirim ke pelanggan');
        this.replyBody = '';
        this.submittingReply.set(false);
        this.loadMessages(ticket.id);
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Gagal mengirim tanggapan');
        this.submittingReply.set(false);
      }
    });
  }

  getPriorityBadgeClass(p: string): string {
    switch (p) {
      case 'URGENT': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  getStatusBadgeClass(s: string): string {
    switch (s) {
      case 'RESOLVED': return 'badge-success';
      case 'IN_PROGRESS': return 'badge-info';
      case 'OPEN': return 'badge-warning';
      default: return 'badge-secondary';
    }
  }
}
