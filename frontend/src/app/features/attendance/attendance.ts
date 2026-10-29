import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PaginationService } from '../../core/services/pagination.service';
import { Paginator } from '../../shared/components/paginator/paginator';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
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
  imports: [CommonModule, FormsModule, Paginator, LoadingSpinner],
  templateUrl: './attendance.html',
  styleUrl: './attendance.scss'
})
export class AttendanceComponent {
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
        this.notice.set(err);
        this.toast.error(err);
        input.value = '';
        return;
      }
      this.busy.set(true);
      this.api.analyzeAttendance(csv).subscribe({
        next: (res) => {
          this.analysis.set(res);
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
