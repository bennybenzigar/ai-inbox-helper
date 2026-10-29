import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationService } from '../../core/services/pagination.service';
import { Paginator } from '../../shared/components/paginator/paginator';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
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
  imports: [CommonModule, FormsModule, Paginator, LoadingSpinner],
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
  }

  onThresholdChange(days: number): void {
    this.thresholdDays.set(days);
    // Re-analyze with same CSV if already loaded
    const data = this.analysis();
    if (data) {
      this.notice.set('Change threshold and re-upload CSV to reanalyze.');
    }
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
        this.notice.set(err);
        this.toast.error(err);
        input.value = '';
        return;
      }
      this.busy.set(true);
      this.api.analyzeStallAlerter(csv, this.thresholdDays()).subscribe({
        next: (res) => {
          this.analysis.set(res);
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
