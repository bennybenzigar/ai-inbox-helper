import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationService } from '../../core/services/pagination.service';
import { Paginator } from '../../shared/components/paginator/paginator';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { environment } from '../../../environments/environment';

export interface AttendanceFlag {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hoursWorked: number;
  leaveType: string;
  flagType: string;
  severity: string;
  explanation: string;
}

export interface AttendanceAnalysis {
  totalRecords: number;
  flaggedCount: number;
  employeesAnalyzed: number;
  flags: AttendanceFlag[];
  summary: {
    overtimeFlags: number;
    missingHourFlags: number;
    consecutiveLeaveFlags: number;
    weekendWorkFlags: number;
  };
}

@Component({
  standalone: true,
  selector: 'app-attendance',
  imports: [CommonModule, FormsModule, Paginator, LoadingSpinner, ConfirmModal],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss'
})
export class AttendanceComponent implements OnInit {
  readonly Math = Math;
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly pager = inject(PaginationService);

  readonly busy = signal(false);
  readonly notice = signal('');
  readonly analysis = signal<AttendanceAnalysis | null>(null);
  readonly selectedFilter = signal<string>('all');
  readonly page = signal(1);
  readonly sampleCsvUrl = `${environment.apiBaseUrl}/api/tools/attendance/sample`;

  readonly selectedIds = signal<Set<string>>(new Set<string>());
  readonly confirmModalOpen = signal(false);
  readonly confirmModalTitle = signal('');
  readonly confirmModalMessage = signal('');
  private pendingDeleteIds: string[] = [];

  ngOnInit(): void {
    this.loadSaved();
  }

  loadSaved(): void {
    this.busy.set(true);
    this.api.getAttendanceAnalysis().subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res?.data) {
          this.analysis.set(res.data);
          this.page.set(1);
        }
      },
      error: () => {
        this.busy.set(false);
      }
    });
  }

  downloadSample(): void {
    this.api.downloadCsvFromUrl(this.sampleCsvUrl, 'attendance_sample.csv');
  }

  readonly filteredFlags = computed(() => {
    const data = this.analysis();
    if (!data) return [];
    const f = this.selectedFilter();
    return f === 'all' ? data.flags : data.flags.filter((x) => x.flagType === f);
  });

  readonly pagedFlags = computed(() => {
    const all = this.filteredFlags();
    const size = this.pager.pageSize();
    const start = (this.page() - 1) * size;
    return all.slice(start, start + size);
  });

  onFilterChange(f: string): void {
    this.selectedFilter.set(f);
    this.page.set(1);
    this.clearSelection();
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
    const paged = this.pagedFlags();
    if (!paged.length) return false;
    const current = this.selectedIds();
    return paged.every((f) => current.has(f.id));
  }

  toggleSelectAll(): void {
    const paged = this.pagedFlags();
    if (!paged.length) return;
    const next = new Set(this.selectedIds());
    if (this.isAllCurrentPageSelected()) {
      for (const f of paged) next.delete(f.id);
    } else {
      for (const f of paged) next.add(f.id);
    }
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set<string>());
  }

  promptDeleteSingle(flag: AttendanceFlag, event?: Event): void {
    event?.stopPropagation();
    this.pendingDeleteIds = [flag.id];
    this.confirmModalTitle.set('Delete Attendance Flag');
    this.confirmModalMessage.set(`Are you sure you want to delete the flag for "${flag.employeeName}" (${flag.flagType}) on ${flag.date}?`);
    this.confirmModalOpen.set(true);
  }

  promptDeleteSelected(): void {
    const count = this.selectedIds().size;
    if (count === 0) return;
    this.pendingDeleteIds = Array.from(this.selectedIds());
    this.confirmModalTitle.set('Delete Selected Flags');
    this.confirmModalMessage.set(`Are you sure you want to delete ${count} selected attendance flag${count > 1 ? 's' : ''}?`);
    this.confirmModalOpen.set(true);
  }

  closeConfirmModal(): void {
    this.confirmModalOpen.set(false);
    this.pendingDeleteIds = [];
  }

  executeDelete(): void {
    const data = this.analysis();
    const ids = this.pendingDeleteIds;
    if (!data || ids.length === 0) {
      this.closeConfirmModal();
      return;
    }

    this.busy.set(true);
    const deleteObs = ids.length === 1
      ? this.api.deleteAttendanceFlag(ids[0])
      : this.api.deleteAttendanceFlags(ids);

    deleteObs.subscribe({
      next: () => {
        this.busy.set(false);
        const toDeleteSet = new Set(ids);
        const count = toDeleteSet.size;
        const remainingFlags = data.flags.filter((f) => !toDeleteSet.has(f.id));

        const newSummary = {
          overtimeFlags: remainingFlags.filter((f) => f.flagType === 'Overtime').length,
          missingHourFlags: remainingFlags.filter((f) => f.flagType === 'Missing Hours').length,
          consecutiveLeaveFlags: remainingFlags.filter((f) => f.flagType === 'Consecutive Leave').length,
          weekendWorkFlags: remainingFlags.filter((f) => f.flagType === 'Weekend Work').length,
        };
        const uniqueEmployees = new Set(remainingFlags.map((f) => f.employeeId)).size;

        this.analysis.set({
          ...data,
          flags: remainingFlags,
          flaggedCount: remainingFlags.length,
          employeesAnalyzed: uniqueEmployees || (remainingFlags.length === 0 ? 0 : data.employeesAnalyzed),
          summary: newSummary
        });

        // Remove from selection
        const nextSelected = new Set(this.selectedIds());
        for (const id of toDeleteSet) {
          nextSelected.delete(id);
        }
        this.selectedIds.set(nextSelected);

        // Adjust page if current page exceeds maximum
        const remainingFiltered = this.filteredFlags().length;
        const maxPage = Math.max(1, Math.ceil(remainingFiltered / this.pager.pageSize()));
        if (this.page() > maxPage) {
          this.page.set(maxPage);
        }

        this.closeConfirmModal();
        this.toast.success(`Deleted ${count} attendance flag${count > 1 ? 's' : ''} from database.`);
      },
      error: (err) => {
        this.busy.set(false);
        this.closeConfirmModal();
        this.toast.error(err?.error?.error || 'Failed to delete attendance flag(s) from database.');
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const csv = reader.result as string;
      if (!csv || !csv.trim()) {
        const err = 'Selected CSV file is empty. Please upload a file with valid attendance records.';
        this.analysis.set(null);
        this.clearSelection();
        this.notice.set(err);
        this.toast.error(err);
        input.value = '';
        return;
      }
      this.busy.set(true);
      this.api.analyzeAttendance(csv).subscribe({
        next: (res) => {
          this.analysis.set(res);
          this.clearSelection();
          this.page.set(1);
          this.busy.set(false);
          const msg = `Analyzed ${res.totalRecords} records across ${res.employeesAnalyzed} employees (${res.flaggedCount} anomalies detected).`;
          this.notice.set(msg);
          this.toast.success(msg);
          input.value = '';
        },
        error: (errRes) => {
          this.busy.set(false);
          this.analysis.set(null);
          this.clearSelection();
          const err = errRes?.error?.error || 'Failed to parse CSV. Empty files or title-only files are not allowed. Required columns: employee_id, employee_name, date, hours_worked, leave_type.';
          this.notice.set(err);
          this.toast.error(err);
          input.value = '';
        }
      });
    };
    reader.readAsText(file);
  }

  exportResultsCsv(onlyCurrentPage = false): void {
    const list = onlyCurrentPage ? this.pagedFlags() : this.filteredFlags();
    if (!list.length) {
      this.toast.info('No attendance flags match the active filters to export.');
      return;
    }
    const headers = ['employee_id','employee_name','date','hours_worked','leave_type','flag_type','severity','explanation'];
    const rows = list.map(f =>
      [f.employeeId, f.employeeName, f.date, f.hoursWorked, f.leaveType, f.flagType, f.severity,
       `"${f.explanation.replace(/"/g,'""')}"`].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const filename = onlyCurrentPage
      ? `attendance_flags_page_${this.page()}_export.csv`
      : `attendance_flags_filtered_export.csv`;
    this.api.downloadCsvContent(csv, filename);
    this.toast.success(`Exported ${list.length} flag${list.length > 1 ? 's' : ''} (${onlyCurrentPage ? 'Current Page' : 'Filtered Data'}).`);
  }
}
