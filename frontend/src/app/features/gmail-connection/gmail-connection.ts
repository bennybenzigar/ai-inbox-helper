import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { EventService } from '../../core/services/event.service';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-gmail-connection',
  imports: [DatePipe, ConfirmModal],
  templateUrl: './gmail-connection.html',
  styleUrl: './gmail-connection.scss'
})
export class GmailConnection implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private events = inject(EventService);

  readonly configured = signal(false);
  readonly connected = signal(false);
  readonly account = signal<string | null>(null);
  readonly lastSyncedAt = signal<string | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly confirmDisconnectOpen = signal(false);

  ngOnInit(): void {
    // Handle OAuth callback query params (?connected=true or ?error=oauth_denied)
    const qConnected = this.route.snapshot.queryParamMap.get('connected');
    const qError = this.route.snapshot.queryParamMap.get('error');
    if (qConnected === 'true') {
      this.notice.set('Gmail connected successfully. Initial sync is running in the background.');
    }
    if (qError) {
      this.error.set(
        qError === 'oauth_denied'
          ? 'Gmail authorization was denied. Please try again and grant the requested permissions.'
          : `OAuth error: ${qError}`
      );
    }

    this.loadStatus();

    // React to SSE gmail-notification-received events
    this.events.events.subscribe((e) => {
      if (e.type === 'gmail-notification-received') {
        this.loadStatus();
      }
    });
  }

  private loadStatus(): void {
    this.api.getStatus().subscribe({
      next: (r) => {
        this.configured.set(r.gmail.configured);
        this.connected.set(r.gmail.connected);
        this.account.set(r.gmail.account);
        this.lastSyncedAt.set(r.gmail.lastSyncedAt);
      },
      error: () => {
        this.error.set('Backend unavailable. Start the API on port 3000.');
      }
    });
  }

  connect(): void {
    if (!this.configured()) {
      this.error.set(
        'Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file and restart the server.'
      );
      return;
    }
    window.location.href = `${environment.apiBaseUrl}/auth/google`;
  }

  disconnect(): void {
    this.promptDisconnect();
  }

  promptDisconnect(): void {
    this.confirmDisconnectOpen.set(true);
  }

  cancelDisconnect(): void {
    this.confirmDisconnectOpen.set(false);
  }

  executeDisconnect(): void {
    this.busy.set(true);
    this.api.disconnectGmail().subscribe({
      next: () => {
        this.confirmDisconnectOpen.set(false);
        this.connected.set(false);
        this.account.set(null);
        this.lastSyncedAt.set(null);
        this.notice.set('Gmail disconnected.');
        this.busy.set(false);
      },
      error: () => {
        this.confirmDisconnectOpen.set(false);
        this.error.set('Disconnect request failed. Check backend availability.');
        this.busy.set(false);
      }
    });
  }
}
