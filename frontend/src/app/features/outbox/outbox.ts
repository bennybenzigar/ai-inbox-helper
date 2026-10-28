import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { EventService } from '../../core/services/event.service';
import { PaginationService } from '../../core/services/pagination.service';
import { ToastService } from '../../core/services/toast.service';
import { INTENTS, OutboxItem } from '../../core/models/inbox.models';
import { IntentBadge } from '../../shared/components/intent-badge/intent-badge';
import { Paginator } from '../../shared/components/paginator/paginator';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-outbox',
  imports: [DatePipe, RouterLink, IntentBadge, Paginator, ConfirmModal, LoadingSpinner],
  templateUrl: './outbox.html',
  styleUrl: './outbox.scss'
})
export class Outbox implements OnInit, OnDestroy {
  readonly Math = Math;
  private api = inject(ApiService);
  private events = inject(EventService);
  private toast = inject(ToastService);
  readonly pager = inject(PaginationService);
  readonly intents = INTENTS;

  readonly items = signal<OutboxItem[]>([]);
  readonly total = signal(0);
  readonly busy = signal(false);
  readonly search = signal('');
  readonly isSearching = signal(false);
  readonly selectedIntent = signal('all');
  readonly page = signal(1);
  readonly exportCsvUrl = `${environment.apiBaseUrl}/api/outbox/export-csv`;
  private eventSub?: Subscription;
  private searchSub?: Subscription;
  readonly searchSubject = new Subject<string>();

  // Multi-selection state
  readonly selectedIds = signal<Set<string>>(new Set());

  // Confirm delete modal state
  readonly modalOpen = signal(false);
  readonly modalTitle = signal('');
  readonly modalMessage = signal('');
  readonly pendingDeleteIds = signal<string[]>([]);

  // Preview sent email modal
  readonly previewItem = signal<OutboxItem | null>(null);

  readonly filteredItems = computed(() => this.items());
  readonly pagedItems = computed(() => this.items());

  ngOnInit(): void {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.search.set(term);
        this.isSearching.set(false);
        this.page.set(1);
        this.load();
      });

    this.load();
    this.eventSub = this.events.events.subscribe((e) => {
      if (e.type === 'messages-updated' || e.type === 'draft-updated') {
        this.load();
      }
    });
  }

  ngOnDestroy(): void {
    this.eventSub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  onSearchInput(value: string): void {
    this.isSearching.set(true);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.search.set('');
    this.isSearching.set(true);
    this.page.set(1);
    this.searchSubject.next('');
  }

  onIntentChange(intent: string): void {
    this.selectedIntent.set(intent);
    this.page.set(1);
    this.load();
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.load();
  }

  load(): void {
    this.busy.set(true);
    this.api
      .getOutbox({
        q: this.search(),
        intent: this.selectedIntent(),
        page: this.page(),
        limit: this.pager.pageSize()
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.total.set(res.total);
          this.busy.set(false);
          this.isSearching.set(false);
        },
        error: () => {
          this.busy.set(false);
          this.isSearching.set(false);
          this.toast.error('Could not load outbox messages. Verify backend is running.');
        }
      });
  }

  downloadExport(onlyCurrentPage = false): void {
    const count = onlyCurrentPage ? this.items().length : this.total();
    if (!count) {
      this.toast.info('No sent messages match the active filters to export.');
      return;
    }
    this.busy.set(true);
    const filters: any = {
      q: this.search(),
      intent: this.selectedIntent()
    };
    if (onlyCurrentPage) {
      filters.page = this.page();
      filters.limit = this.pager.pageSize();
    }
    const url = this.api.getOutboxExportUrl(filters);
    const filename = onlyCurrentPage
      ? `candidate_sent_messages_page_${this.page()}_export.csv`
      : `candidate_sent_messages_filtered_export.csv`;

    this.api.downloadCsvFromUrl(
      url,
      filename,
      () => {
        this.busy.set(false);
        this.toast.success(
          onlyCurrentPage
            ? `Exported sent messages (Page ${this.page()}).`
            : `Exported all filtered sent messages (${this.total()} records).`
        );
      },
      () => {
        this.busy.set(false);
        this.toast.error('Failed to export sent messages from server.');
      }
    );
  }

  // Selection helpers
  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isAllCurrentPageSelected(): boolean {
    const msgs = this.pagedItems();
    if (msgs.length === 0) return false;
    return msgs.every((m) => this.selectedIds().has(m.messageId));
  }

  toggleSelectAll(): void {
    const msgs = this.pagedItems();
    if (msgs.length === 0) return;
    const allSelected = this.isAllCurrentPageSelected();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (allSelected) {
        msgs.forEach((m) => next.delete(m.messageId));
      } else {
        msgs.forEach((m) => next.add(m.messageId));
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // Delete actions
  promptDeleteSingle(item: OutboxItem, event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteIds.set([item.messageId]);
    this.modalTitle.set('Delete Sent Message Record');
    this.modalMessage.set(
      `Are you sure you want to delete the sent message to "${item.senderName}" (${item.replySubject})? This will permanently remove the record from your database.`
    );
    this.modalOpen.set(true);
  }

  promptDeleteSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.pendingDeleteIds.set(ids);
    this.modalTitle.set(`Delete ${ids.length} Sent Record${ids.length > 1 ? 's' : ''}`);
    this.modalMessage.set(
      `Are you sure you want to delete ${ids.length} selected sent message record${ids.length > 1 ? 's' : ''}? This action cannot be undone.`
    );
    this.modalOpen.set(true);
  }

  cancelDelete(): void {
    this.modalOpen.set(false);
    this.pendingDeleteIds.set([]);
  }

  executeDelete(): void {
    const ids = this.pendingDeleteIds();
    if (ids.length === 0) return;
    this.busy.set(true);

    if (ids.length === 1) {
      this.api.deleteMessage(ids[0]).subscribe({
        next: () => {
          this.modalOpen.set(false);
          this.selectedIds.update((set) => {
            const next = new Set(set);
            next.delete(ids[0]);
            return next;
          });
          this.toast.success('Sent message record deleted.');
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toast.error(err.error?.error || 'Failed to delete record.');
        }
      });
    } else {
      this.api.deleteMessages(ids).subscribe({
        next: (res) => {
          this.modalOpen.set(false);
          this.clearSelection();
          this.toast.success(`Successfully deleted ${res.deleted} sent records.`);
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toast.error(err.error?.error || 'Failed to delete sent records.');
        }
      });
    }
  }

  // Preview modal
  openPreview(item: OutboxItem, event?: Event): void {
    event?.stopPropagation();
    this.previewItem.set(item);
  }

  closePreview(): void {
    this.previewItem.set(null);
  }
}
