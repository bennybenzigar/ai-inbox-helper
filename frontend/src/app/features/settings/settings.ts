import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { PaginationService } from '../../core/services/pagination.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [FormsModule, ConfirmModal],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly pager = inject(PaginationService);
  readonly notice = signal('');
  readonly aiProvider = signal('');
  readonly mode = signal('');
  readonly busy = signal(false);
  readonly confirmResetOpen = signal(false);

  get pageSize(): number {
    return this.pager.pageSize();
  }
  set pageSize(v: number) {
    this.pager.setPageSize(Number(v));
  }

  ngOnInit(): void {
    this.api.getStatus().subscribe({
      next: (r) => {
        this.aiProvider.set(r.aiProvider || 'unknown');
        this.mode.set(r.mode || 'live');
      },
      error: () => {}
    });
  }

  setPageSize(value: string): void {
    const n = parseInt(value, 10);
    if (!isNaN(n)) this.pager.setPageSize(n);
    const msg = `Page size set to ${n} rows per page.`;
    this.notice.set(msg);
    this.toast.success(msg);
  }

  reset(): void {
    this.promptReset();
  }

  promptReset(): void {
    this.confirmResetOpen.set(true);
  }

  cancelReset(): void {
    this.confirmResetOpen.set(false);
  }

  executeReset(): void {
    this.busy.set(true);
    this.api.resetDemo().subscribe({
      next: () => {
        this.confirmResetOpen.set(false);
        this.busy.set(false);
        this.notice.set('All candidate messages cleared.');
        this.toast.success('All candidate messages cleared from database.');
      },
      error: () => {
        this.confirmResetOpen.set(false);
        this.busy.set(false);
        this.notice.set('Could not clear data. Check the backend is running.');
        this.toast.error('Could not clear data. Backend unavailable.');
      }
    });
  }
}
