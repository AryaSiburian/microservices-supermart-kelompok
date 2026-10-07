import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CustomerTicket, TicketCategory, TicketMessage, FAQArticle } from '../../../core/models/types';
import { NotificationService } from '../../../core/services/notification.service';

interface APIResponse<T> {
  success: boolean;
  data: T;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container support-page">
      <div class="page-header">
        <h1>Pusat Bantuan & Layanan Pelanggan</h1>
        <p>Ajukan pertanyaan, konsultasikan kendala pesanan, atau hubungi CS Agent kami</p>
      </div>

      <!-- FAQ Section -->
      <div class="card faq-card">
        <h3>Pertanyaan Populer (FAQ)</h3>
        <div class="faq-grid">
          @for (faq of faqs(); track faq.id) {
            <div class="faq-item">
              <span class="faq-cat">{{ faq.category_name }}</span>
              <h4 class="faq-q">❓ {{ faq.question }}</h4>
              <p class="faq-a">{{ faq.answer }}</p>
            </div>
          }
        </div>
      </div>

      <!-- Tickets Section -->
      <div class="card tickets-card">
        <div class="tickets-header">
          <div>
            <h3>Tiket Pengaduan Saya</h3>
            <p>Riwayat percakapan langsung dengan customer service kami</p>
          </div>
          <button (click)="openCreateModal.set(true)" class="btn btn-primary" id="btn-create-ticket">
            + Buat Tiket Baru
          </button>
        </div>

        @if (tickets().length === 0) {
          <p class="empty-text">Belum ada tiket keluhan yang Anda buat.</p>
        } @else {
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Kode Tiket</th>
                  <th>Kategori</th>
                  <th>Subjek</th>
                  <th>Prioritas</th>
                  <th>Status</th>
                  <th>Waktu Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tickets(); track t.id) {
                  <tr>
                    <td><strong>{{ t.ticket_code }}</strong></td>
                    <td>{{ t.category_name }}</td>
                    <td>{{ t.subject }}</td>
                    <td>
                      <span class="badge" [class.badge-danger]="t.priority === 'HIGH' || t.priority === 'URGENT'" [class.badge-warning]="t.priority === 'MEDIUM'" [class.badge-primary]="t.priority === 'LOW'">
                        {{ t.priority }}
                      </span>
                    </td>
                    <td>
                      <span class="badge" [class.badge-success]="t.status === 'RESOLVED' || t.status === 'CLOSED'" [class.badge-warning]="t.status === 'IN_PROGRESS'" [class.badge-primary]="t.status === 'OPEN'">
                        {{ t.status }}
                      </span>
                    </td>
                    <td>{{ t.created_at | date:'dd MMM, HH:mm' }}</td>
                    <td>
                      <button (click)="openThread(t.id)" class="btn btn-outline btn-sm">
                        💬 Percakapan
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Create Ticket Modal -->
      @if (openCreateModal()) {
        <div class="modal-backdrop" (click)="openCreateModal.set(false)">
          <div class="modal card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Buat Tiket Bantuan Baru</h3>
              <button (click)="openCreateModal.set(false)" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Kategori Kendala</label>
                <select class="form-control" [(ngModel)]="newTicket.category_id">
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.category_name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Subjek Keluhan</label>
                <input type="text" class="form-control" [(ngModel)]="newTicket.subject" placeholder="Jelaskan ringkas kendala Anda" />
              </div>

              <div class="form-group">
                <label class="form-label">Tingkat Urgensi</label>
                <select class="form-control" [(ngModel)]="newTicket.priority">
                  <option value="LOW">Rendah (Low)</option>
                  <option value="MEDIUM">Sedang (Medium)</option>
                  <option value="HIGH">Tinggi (High)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Pesan Detail</label>
                <textarea class="form-control" [(ngModel)]="newTicket.message" rows="3" placeholder="Tuliskan nomor pesanan atau detail masalah..."></textarea>
              </div>

              <button (click)="submitTicket()" class="btn btn-primary btn-lg" style="width: 100%;">
                Kirim Tiket ke CS Agent →
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Conversation Drawer Modal -->
      @if (selectedTicketThread()) {
        <div class="modal-backdrop" (click)="selectedTicketThread.set(null)">
          <div class="modal card thread-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Percakapan #{{ selectedTicketThread()?.ticket?.ticket_code }}</h3>
              <button (click)="selectedTicketThread.set(null)" class="close-btn">✕</button>
            </div>
            <div class="modal-body">
              <div class="messages-container">
                @for (msg of selectedTicketThread()?.messages; track msg.id) {
                  <div class="msg-bubble" [class.staff-bubble]="msg.sender_role !== 'CUSTOMER'">
                    <div class="msg-meta">
                      <strong>{{ msg.sender_name }} ({{ msg.sender_role }})</strong>
                      <span>{{ msg.sent_at | date:'HH:mm' }}</span>
                    </div>
                    <p class="msg-text">{{ msg.message_body }}</p>
                  </div>
                }
              </div>

              <div class="reply-input-row">
                <input
                  type="text"
                  class="form-control"
                  [(ngModel)]="replyMessage"
                  placeholder="Ketik balasan Anda..."
                  (keydown.enter)="sendReply()"
                />
                <button (click)="sendReply()" class="btn btn-primary" id="btn-send-reply">Kirim</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .support-page {
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
    .faq-card {
      padding: 1.75rem;
      margin-bottom: 2rem;
    }
    .faq-card h3 {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .faq-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .faq-item {
      background: var(--bg-surface-secondary);
      padding: 1.25rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
    }
    .faq-cat {
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--color-primary);
      text-transform: uppercase;
    }
    .faq-q {
      font-size: 0.875rem;
      font-weight: 700;
      margin: 0.25rem 0 0.5rem;
      color: var(--text-primary);
    }
    .faq-a {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .tickets-card {
      padding: 1.75rem;
    }
    .tickets-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .tickets-header h3 {
      font-size: 1.125rem;
      font-weight: 700;
    }
    .tickets-header p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }
    .empty-text {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
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
      max-width: 500px;
      padding: 2rem;
      background: white;
    }
    .thread-modal {
      max-width: 600px;
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
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-height: 320px;
      overflow-y: auto;
      padding: 0.5rem;
      background: var(--bg-surface-secondary);
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
    }
    .msg-bubble {
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      background: white;
      border: 1px solid var(--border-color);
      max-width: 85%;
      align-self: flex-start;
    }
    .staff-bubble {
      align-self: flex-end;
      background: var(--color-primary-light);
      border-color: #bae6fd;
    }
    .msg-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.6875rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }
    .msg-text {
      font-size: 0.8125rem;
      color: var(--text-primary);
    }
    .reply-input-row {
      display: flex;
      gap: 0.5rem;
    }
  `]
})
export class SupportComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  tickets = signal<CustomerTicket[]>([]);
  categories = signal<TicketCategory[]>([]);
  faqs = signal<FAQArticle[]>([]);

  openCreateModal = signal(false);
  selectedTicketThread = signal<any | null>(null);
  replyMessage = '';

  newTicket = {
    category_id: '',
    subject: '',
    priority: 'MEDIUM',
    message: ''
  };

  ngOnInit() {
    this.loadTickets();
    this.loadCategories();
    this.loadFAQs();
  }

  loadTickets() {
    this.http.get<APIResponse<CustomerTicket[]>>('/api/v1/support/tickets').subscribe(res => {
      if (res.success && res.data) {
        this.tickets.set(res.data);
      }
    });
  }

  loadCategories() {
    this.http.get<APIResponse<TicketCategory[]>>('/api/v1/support/categories').subscribe(res => {
      if (res.success && res.data) {
        this.categories.set(res.data);
        if (res.data.length > 0) {
          this.newTicket.category_id = res.data[0].id;
        }
      }
    });
  }

  loadFAQs() {
    this.http.get<APIResponse<FAQArticle[]>>('/api/v1/support/faq').subscribe(res => {
      if (res.success && res.data) {
        this.faqs.set(res.data);
      }
    });
  }

  submitTicket() {
    if (!this.newTicket.subject || !this.newTicket.message) {
      this.notify.error('Lengkapi subjek dan pesan detail');
      return;
    }
    this.http.post<APIResponse<CustomerTicket>>('/api/v1/support/tickets', this.newTicket).subscribe({
      next: () => {
        this.notify.success('Tiket pengaduan berhasil dikirim ke tim CS');
        this.openCreateModal.set(false);
        this.loadTickets();
      },
      error: () => this.notify.error('Gagal membuat tiket')
    });
  }

  openThread(ticketId: string) {
    this.http.get<APIResponse<any>>(`/api/v1/support/tickets/${ticketId}`).subscribe(res => {
      if (res.success && res.data) {
        this.selectedTicketThread.set(res.data);
      }
    });
  }

  sendReply() {
    const thread = this.selectedTicketThread();
    if (!thread || !this.replyMessage) return;

    this.http.post<APIResponse<TicketMessage>>(`/api/v1/support/tickets/${thread.ticket.id}/messages`, {
      message_body: this.replyMessage
    }).subscribe({
      next: res => {
        this.replyMessage = '';
        this.openThread(thread.ticket.id);
      },
      error: () => this.notify.error('Gagal mengirim balasan')
    });
  }
}
