import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  DashboardStats,
  Draft,
  InboxMessage,
  Intent,
  OutboxItem,
} from "../models/inbox.models";
@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  getStatus(): Observable<{
    mode: string;
    demoMode: boolean;
    gmail: {
      configured: boolean;
      connected: boolean;
      account: string | null;
      lastSyncedAt: string | null;
    };
    aiProvider: string;
    liveClients: number;
  }> {
    return this.http.get<any>(`${this.base}/api/status`);
  }
  getDashboard(): Observable<{ stats: DashboardStats }> {
    return this.http.get<any>(`${this.base}/api/dashboard`);
  }
  getMessages(filters: { q?: string; intent?: string; status?: string; page?: number; limit?: number } = {}) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return this.http.get<{ items: InboxMessage[]; total: number; page?: number; limit?: number; totalPages?: number }>(
      `${this.base}/api/messages`,
      { params: p },
    );
  }
  getOutbox(filters: { q?: string; intent?: string; page?: number; limit?: number } = {}) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') {
        p = p.set(k, String(v));
      }
    }
    return this.http.get<{ items: OutboxItem[]; total: number; page?: number; limit?: number; totalPages?: number }>(
      `${this.base}/api/outbox`,
      { params: p },
    );
  }
  getMessage(id: string) {
    return this.http.get<{ message: InboxMessage; draft: Draft | null }>(
      `${this.base}/api/messages/${encodeURIComponent(id)}`,
    );
  }
  getIntents() {
    return this.http.get<{ items: { intent: Intent; count: number }[] }>(
      `${this.base}/api/intents`,
    );
  }
  importDemo(count = 24) {
    return this.http.post<{ imported: number; total: number }>(
      `${this.base}/api/demo/import`,
      { count },
    );
  }
  resetDemo() {
    return this.http.delete<{ ok: boolean }>(`${this.base}/api/demo/data`);
  }
  syncGmail() {
    return this.http.post<{ synced: number; total: number }>(`${this.base}/api/gmail/sync`, {});
  }
  getGmailSyncStatus() {
    return this.http.get<{ connected: boolean; lastSyncedAt: string | null; intervalMinutes: number }>(`${this.base}/api/gmail/sync-status`);
  }
  getDrafts(status = "all") {
    return this.http.get<{ items: Draft[]; total: number }>(
      `${this.base}/api/drafts`,
      { params: { status } },
    );
  }
  createDraft(id: string) {
    return this.http.post<{ draft: Draft }>(
      `${this.base}/api/messages/${encodeURIComponent(id)}/draft`,
      {},
    );
  }
  updateDraft(id: string, body: string) {
    return this.http.patch<{ draft: Draft }>(
      `${this.base}/api/drafts/${encodeURIComponent(id)}`,
      { body },
    );
  }
  regenerateDraft(id: string) {
    return this.http.post<{ draft: Draft }>(
      `${this.base}/api/drafts/${encodeURIComponent(id)}/regenerate`,
      {},
    );
  }
  reviewDraft(id: string, action: "approve" | "reject") {
    return this.http.post<{ draft: Draft; note: string }>(
      `${this.base}/api/drafts/${encodeURIComponent(id)}/${action}`,
      {},
    );
  }
  disconnectGmail() {
    return this.http.post<{ ok: boolean }>(`${this.base}/auth/disconnect`, {});
  }
  uploadMessagesCSV(csv: string) {
    return this.http.post<{ imported: number; total: number }>(
      `${this.base}/api/messages/upload-csv`,
      { csv }
    );
  }
  sendDraft(id: string) {
    return this.http.post<{ draft: Draft; sent: boolean; simulated: boolean; note: string }>(
      `${this.base}/api/drafts/${encodeURIComponent(id)}/send`,
      {}
    );
  }
  deleteMessage(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/api/messages/${encodeURIComponent(id)}`);
  }
  deleteMessages(ids: string[]) {
    return this.http.post<{ ok: boolean; deleted: number }>(`${this.base}/api/messages/bulk-delete`, { ids });
  }
  analyzeAttendance(csv?: string) {
    return this.http.post<{
      totalRecords: number;
      flaggedCount: number;
      employeesAnalyzed: number;
      flags: Array<{
        id: string;
        employeeId: string;
        employeeName: string;
        date: string;
        hoursWorked: number;
        leaveType: string;
        flagType: string;
        severity: string;
        explanation: string;
      }>;
      summary: {
        overtimeFlags: number;
        missingHourFlags: number;
        consecutiveLeaveFlags: number;
        weekendWorkFlags: number;
      };
    }>(`${this.base}/api/tools/attendance/analyze`, { csv });
  }
  getAttendanceAnalysis() {
    return this.http.get<{
      data: {
        totalRecords: number;
        flaggedCount: number;
        employeesAnalyzed: number;
        flags: Array<{
          id: string;
          employeeId: string;
          employeeName: string;
          date: string;
          hoursWorked: number;
          leaveType: string;
          flagType: string;
          severity: string;
          explanation: string;
        }>;
        summary: {
          overtimeFlags: number;
          missingHourFlags: number;
          consecutiveLeaveFlags: number;
          weekendWorkFlags: number;
        };
      } | null;
    }>(`${this.base}/api/tools/attendance`);
  }
  deleteAttendanceFlag(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/api/tools/attendance/flags/${id}`);
  }
  deleteAttendanceFlags(ids: string[]) {
    return this.http.post<{ ok: boolean; deleted: number }>(`${this.base}/api/tools/attendance/flags/bulk-delete`, { ids });
  }
  analyzeStallAlerter(csv?: string, thresholdDays = 5) {
    return this.http.post<{
      totalCandidates: number;
      stalledCount: number;
      thresholdDays: number;
      alerts: Array<{
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
      }>;
      summary: {
        criticalCount: number;
        highCount: number;
        mediumCount: number;
      };
    }>(`${this.base}/api/tools/stall-alerter/analyze`, { csv, thresholdDays });
  }
  getStallAnalysis() {
    return this.http.get<{
      data: {
        totalCandidates: number;
        stalledCount: number;
        thresholdDays: number;
        alerts: Array<{
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
        }>;
        summary: {
          criticalCount: number;
          highCount: number;
          mediumCount: number;
        };
      } | null;
    }>(`${this.base}/api/tools/stall-alerter`);
  }
  deleteStallAlert(id: string) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/api/tools/stall-alerter/alerts/${id}`);
  }
  deleteStallAlerts(ids: string[]) {
    return this.http.post<{ ok: boolean; deleted: number }>(`${this.base}/api/tools/stall-alerter/alerts/bulk-delete`, { ids });
  }

  getMessagesExportUrl(filters: { q?: string; intent?: string; status?: string; page?: number; limit?: number } = {}): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return `${this.base}/api/messages/export-csv${qs ? `?${qs}` : ''}`;
  }

  getOutboxExportUrl(filters: { q?: string; intent?: string; page?: number; limit?: number } = {}): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return `${this.base}/api/outbox/export-csv${qs ? `?${qs}` : ''}`;
  }

  downloadCsvFromUrl(
    url: string,
    filename: string,
    onSuccess?: () => void,
    onError?: (err: any) => void
  ): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        onSuccess?.();
      },
      error: (err) => {
        onError?.(err);
        window.open(url, '_blank');
      }
    });
  }

  downloadCsvContent(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
