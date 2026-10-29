import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { EventService } from '../../core/services/event.service';
import { InboxStateService } from '../../core/services/inbox-state.service';
import { PaginationService } from '../../core/services/pagination.service';
import { ToastService } from '../../core/services/toast.service';
import { INTENTS, InboxMessage } from '../../core/models/inbox.models';
import { IntentBadge } from '../../shared/components/intent-badge/intent-badge';
import { Paginator } from '../../shared/components/paginator/paginator';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-inbox',
  imports: [DatePipe, RouterLink, IntentBadge, Paginator, ConfirmModal, LoadingSpinner],
  templateUrl: './inbox.html',
  styleUrl: './inbox.scss'
})
export class Inbox implements OnInit, OnDestroy {
  readonly Math = Math;
  readonly state = inject(InboxStateService);
  private api = inject(ApiService);
  private events = inject(EventService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly pager = inject(PaginationService);
  readonly intents = INTENTS;
  readonly busy = signal(false);
  readonly isSearching = signal(false);
  readonly notice = signal('');
  readonly page = signal(1);
  readonly sampleCsvUrl = `${environment.apiBaseUrl}/api/messages/sample-csv`;
  readonly exportCsvUrl = `${environment.apiBaseUrl}/api/messages/export-csv`;
  private eventSub?: Subscription;
  private querySub?: Subscription;
  private searchSub?: Subscription;
  readonly searchSubject = new Subject<string>();

  // Multi-selection state
  readonly selectedIds = signal<Set<string>>(new Set());

  // Confirm delete modal state
  readonly modalOpen = signal(false);
  readonly modalTitle = signal('');
  readonly modalMessage = signal('');
  readonly pendingDeleteIds = signal<string[]>([]);

  downloadSample(): void {
    this.api.downloadCsvFromUrl(this.sampleCsvUrl, 'candidate_messages_sample.csv');
  }

  downloadExport(onlyCurrentPage = false): void {
    const count = onlyCurrentPage ? this.pagedMessages().length : this.state.total();
    if (!count) {
      this.toast.info('No messages match the active filters to export.');
      return;
    }
    this.busy.set(true);
    const filters: any = {
      q: this.state.search(),
      intent: this.state.selectedIntent(),
      status: this.state.selectedStatus()
    };
    if (onlyCurrentPage) {
      filters.page = this.page();
      filters.limit = this.pager.pageSize();
    }
    const url = this.api.getMessagesExportUrl(filters);
    const filename = onlyCurrentPage
      ? `candidate_messages_page_${this.page()}_export.csv`
      : `candidate_messages_filtered_export.csv`;

    this.api.downloadCsvFromUrl(
      url,
      filename,
      () => {
        this.busy.set(false);
        this.toast.success(
          onlyCurrentPage
            ? `Exported candidate messages (Page ${this.page()}).`
            : `Exported all filtered candidate messages (${this.state.total()} records).`
        );
      },
      () => {
        this.busy.set(false);
        this.toast.error('Failed to export candidate messages from server.');
      }
    );
  }

  readonly pagedMessages = computed(() => this.state.messages());

  ngOnInit(): void {
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((term) => {
        this.state.search.set(term);
        this.page.set(1);
        this.load();
      });

    this.querySub = this.route.queryParams.subscribe((params) => {
      const intentParam = params['intent'];
      if (intentParam && intentParam !== 'all') {
        this.state.selectedIntent.set(intentParam);
      } else if (!params['intent']) {
        this.state.selectedIntent.set('all');
      }
      this.page.set(1);
      this.load();
    });

    this.eventSub = this.events.events.subscribe((e) => {
      if (e.type === 'messages-updated') this.load();
    });
  }

  ngOnDestroy(): void {
    this.eventSub?.unsubscribe();
    this.querySub?.unsubscribe();
    this.searchSub?.unsubscribe();
  }

  onSearchInput(value: string): void {
    this.isSearching.set(true);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.state.search.set('');
    this.isSearching.set(true);
    this.page.set(1);
    this.searchSubject.next('');
  }

  onIntentChange(intent: string): void {
    this.state.selectedIntent.set(intent);
    this.page.set(1);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: intent === 'all' ? { intent: null } : { intent },
      queryParamsHandling: 'merge'
    });
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
    this.load();
  }

  load(): void {
    this.busy.set(true);
    this.api.getMessages({
      q: this.state.search(),
      intent: this.state.selectedIntent(),
      status: this.state.selectedStatus(),
      page: this.page(),
      limit: this.pager.pageSize()
    }).subscribe({
      next: (r) => {
        this.state.setMessages(r.items, r.total);
        this.busy.set(false);
        this.isSearching.set(false);
      },
      error: () => {
        this.notice.set('Cannot reach the backend. Start it on port 3000.');
        this.toast.error('Cannot reach the backend service.');
        this.busy.set(false);
        this.isSearching.set(false);
      }
    });
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const csvText = reader.result as string;
      if (!csvText || !csvText.trim()) {
        this.toast.error('Selected CSV file is empty. Please upload a file with valid candidate messages.');
        input.value = '';
        return;
      }
      this.busy.set(true);
      this.api.uploadMessagesCSV(csvText).subscribe({
        next: (res) => {
          this.toast.success(`Imported ${res.imported} candidate messages from CSV.`);
          input.value = '';
          this.clearSelection();
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toast.error(err.error?.error || 'CSV upload failed. Verify columns: senderName, senderEmail, subject, body.');
          input.value = '';
        }
      });
    };
    reader.readAsText(file);
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
    const msgs = this.pagedMessages();
    if (msgs.length === 0) return false;
    return msgs.every((m) => this.selectedIds().has(m.id));
  }

  toggleSelectAll(): void {
    const msgs = this.pagedMessages();
    if (msgs.length === 0) return;
    const allSelected = this.isAllCurrentPageSelected();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (allSelected) {
        msgs.forEach((m) => next.delete(m.id));
      } else {
        msgs.forEach((m) => next.add(m.id));
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // Deletion logic
  promptDeleteSingle(m: InboxMessage, event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteIds.set([m.id]);
    this.modalTitle.set('Delete Candidate Message');
    this.modalMessage.set(`Are you sure you want to delete message from "${m.senderName}" (${m.subject})? This action cannot be undone.`);
    this.modalOpen.set(true);
  }

  promptDeleteSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    this.pendingDeleteIds.set(ids);
    this.modalTitle.set(`Delete ${ids.length} Selected Message${ids.length > 1 ? 's' : ''}`);
    this.modalMessage.set(`Are you sure you want to delete ${ids.length} selected candidate message${ids.length > 1 ? 's' : ''} and all associated AI drafts? This action cannot be undone.`);
    this.modalOpen.set(true);
  }

  cancelDelete(): void {
    this.modalOpen.set(false);
    this.pendingDeleteIds.set([]);
  }

  private clampPageAfterDelete(deletedCount: number): void {
    const remaining = Math.max(0, this.state.total() - deletedCount);
    const maxPage = Math.max(1, Math.ceil(remaining / this.pager.pageSize()));
    if (this.page() > maxPage) {
      this.page.set(maxPage);
    }
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
          this.toast.success('Message deleted successfully.');
          this.clampPageAfterDelete(1);
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toast.error(err.error?.error || 'Failed to delete message.');
        }
      });
    } else {
      this.api.deleteMessages(ids).subscribe({
        next: (res) => {
          this.modalOpen.set(false);
          this.clearSelection();
          this.toast.success(`Successfully deleted ${res.deleted} messages.`);
          this.clampPageAfterDelete(res.deleted);
          this.load();
        },
        error: (err) => {
          this.busy.set(false);
          this.toast.error(err.error?.error || 'Failed to delete selected messages.');
        }
      });
    }
  }
}

