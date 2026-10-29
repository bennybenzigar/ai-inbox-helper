import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationService } from '../../core/services/pagination.service';
import { Paginator } from '../../shared/components/paginator/paginator';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { environment } from '../../../environments/environment';

export interface StalledAlert {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  stage: string;
  daysInStage: number;
  lastActivityDate: string;
  assignedRecruiter: string;
  urgency: string;
  priorityRank: number;
  recommendedAction: string;
}

export interface StallAnalysis {
  totalCandidates: number;
  stalledCount: number;
  thresholdDays: number;
  alerts: StalledAlert[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
  };
}

@Component({
  standalone: true,
  selector: 'app-stall-alerter',
  imports: [CommonModule, FormsModule, Paginator, LoadingSpinner, ConfirmModal],
  templateUrl: './stall-alerter.html',
  styleUrl: './stall-alerter.scss'
})
export class StallAlerterComponent {
  readonly Math = Math;
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly pager = inject(PaginationService);

  readonly busy = signal(false);
  readonly notice = signal('');
  readonly analysis = signal<StallAnalysis | null>(null);
  readonly thresholdDays = signal<number>(5);
  readonly selectedUrgency = signal<string>('all');
  readonly page = signal(1);
  readonly sampleCsvUrl = `${environment.apiBaseUrl}/api/tools/stall-alerter/sample`;

  readonly selectedIds = signal<Set<string>>(new Set<string>());
  readonly confirmModalOpen = signal(false);
  readonly confirmModalTitle = signal('');
  readonly confirmModalMessage = signal('');
  private pendingDeleteIds: string[] = [];

  downloadSample(): void {
    this.api.downloadCsvFromUrl(this.sampleCsvUrl, 'hiring_board_sample.csv');
  }

  readonly filteredAlerts = computed(() => {
    const data = this.analysis();
    if (!data) return [];
    const f = this.selectedUrgency();
    return f === 'all' ? data.alerts : data.alerts.filter((a) => a.urgency.toLowerCase() === f);
  });

  readonly pagedAlerts = computed(() => {
    const all = this.filteredAlerts();
    const size = this.pager.pageSize();
    const start = (this.page() - 1) * size;
    return all.slice(start, start + size);
  });

  onUrgencyChange(u: string): void {
    this.selectedUrgency.set(u);
    this.page.set(1);
    this.clearSelection();
  }

  onThresholdChange(days: number): void {
    this.thresholdDays.set(days);
    this.clearSelection();
    // Re-analyze with same CSV if already loaded
    const data = this.analysis();
    if (data) {
      this.notice.set('Change threshold and re-upload CSV to reanalyze.');
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  isAllCurrentPageSelected(): boolean {
    const paged = this.pagedAlerts();
    if (!paged.length) return false;
    const current = this.selectedIds();
    return paged.every((a) => current.has(a.id));
  }

  toggleSelectAll(): void {
    const paged = this.pagedAlerts();
    if (!paged.length) return;
    const next = new Set(this.selectedIds());
    if (this.isAllCurrentPageSelected()) {
      for (const a of paged) next.delete(a.id);
    } else {
      for (const a of paged) next.add(a.id);
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set<string>());
  }

  promptDeleteSingle(alert: StalledAlert, event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteIds = [alert.id];
    this.confirmModalTitle.set('Delete Stall Alert');
    this.confirmModalMessage.set(`Are you sure you want to remove the stall alert for candidate "${alert.candidateName}" (${alert.role})?`);
    this.confirmModalOpen.set(true);
  }

  promptDeleteSelected(): void {
    const count = this.selectedIds().size;
    if (count === 0) return;
    this.pendingDeleteIds = Array.from(this.selectedIds());
    this.confirmModalTitle.set('Delete Selected Alerts');
    this.confirmModalMessage.set(`Are you sure you want to delete ${count} selected stall alert${count > 1 ? 's' : ''}?`);
    this.confirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.confirmModalOpen.set(false);
    this.pendingDeleteIds = [];
  }

  executeDelete(): void {
    const data = this.analysis();
    if (!data || this.pendingDeleteIds.length === 0) {
      this.closeConfirmModal();
      return;
    }

    const toDeleteSet = new Set(this.pendingDeleteIds);
    const count = toDeleteSet.size;
    const remainingAlerts = data.alerts.filter((a) => !toDeleteSet.has(a.id));

    // Re-rank remaining alerts sequentially
    const reRanked = remainingAlerts.map((a, idx) => ({ ...a, priorityRank: idx + 1 }));

    const newSummary = {
      criticalCount: reRanked.filter((a) => a.urgency.toLowerCase() === 'critical').length,
      highCount: reRanked.filter((a) => a.urgency.toLowerCase() === 'high').length,
      mediumCount: reRanked.filter((a) => a.urgency.toLowerCase() === 'medium').length,
    };

    this.analysis.set({
      ...data,
      alerts: reRanked,
      stalledCount: reRanked.length,
      summary: newSummary
    });

    // Remove from selection
    const nextSelected = new Set(this.selectedIds());
    for (const id of toDeleteSet) {
      nextSelected.delete(id);
    }
    this.selectedIds.set(nextSelected);

    // Adjust page if current page exceeds maximum
    const remainingFiltered = this.filteredAlerts().length;
    const maxPage = Math.max(1, Math.ceil(remainingFiltered / this.pager.pageSize()));
    if (this.page() > maxPage) {
      this.page.set(maxPage);
    }

    this.closeConfirmModal();
    this.toast.success(`Deleted ${count} stall alert${count > 1 ? 's' : ''}.`);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const csv = reader.result as string;
      if (!csv || !csv.trim()) {
        const err = 'Selected CSV file is empty. Please upload a file with valid candidate records.';
        this.analysis.set(null);
        this.clearSelection();
        this.notice.set(err);
        this.toast.error(err);
        input.value = '';
        return;
      }
      this.busy.set(true);
      this.api.analyzeStallAlerter(csv, this.thresholdDays()).subscribe({
        next: (res) => {
          this.analysis.set(res);
          this.clearSelection();
          this.page.set(1);
          this.busy.set(false);
          const msg = `Analyzed ${res.totalCandidates} candidates — ${res.stalledCount} stalled pipeline candidates detected.`;
          this.notice.set(msg);
          this.toast.success(msg);
          input.value = '';
        },
        error: (errRes) => {
          this.busy.set(false);
          this.analysis.set(null);
          this.clearSelection();
          const err = errRes?.error?.error || 'Failed to parse CSV. Empty files or title-only files are not allowed. Required columns: candidate_name, role, stage, days_in_stage, assigned_recruiter.';
          this.notice.set(err);
          this.toast.error(err);
          input.value = '';
        }
      });
    };
    reader.readAsText(file);
  }

  exportResultsCsv(onlyCurrentPage = false): void {
    const list = onlyCurrentPage ? this.pagedAlerts() : this.filteredAlerts();
    if (!list.length) {
      this.toast.info('No stall alerts match the active filters to export.');
      return;
    }
    const headers = ['priority_rank','candidate_name','candidate_email','role','stage','days_in_stage','assigned_recruiter','urgency','recommended_action'];
    const rows = list.map(a =>
      [a.priorityRank, a.candidateName, a.candidateEmail, a.role, a.stage, a.daysInStage,
       a.assignedRecruiter, a.urgency, `"${a.recommendedAction.replace(/"/g,'""')}"`].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const filename = onlyCurrentPage
      ? `stall_alerts_page_${this.page()}_export.csv`
      : `stall_alerts_filtered_export.csv`;
    this.api.downloadCsvContent(csv, filename);
    this.toast.success(`Exported ${list.length} alert${list.length > 1 ? 's' : ''} (${onlyCurrentPage ? 'Current Page' : 'Filtered Data'}).`);
  }
}
