export const INTENTS = ['Interview Scheduling', 'Application Status', 'Salary & Compensation', 'Document Requests', 'Job Details', 'Other / Unclear'] as const;
export type Intent = typeof INTENTS[number];
export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'sent';
export type SourceType = 'demo' | 'gmail' | 'csv';
export interface Message {
  id: string; source: SourceType; senderName: string; senderEmail: string; subject: string;
  body: string; receivedAt: string; intent: Intent; confidence: number; status: DraftStatus | 'none';
  gmailMessageId?: string; hasAttachments: boolean;
}
export interface Draft {
  id: string; messageId: string; body: string; status: DraftStatus; isMock: boolean;
  version: number; createdAt: string; updatedAt: string; reviewedAt: string | null;
}
export interface Activity { id: string; type: string; message: string; createdAt: string; }
export interface OutboxItem {
  id: string;
  messageId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  replySubject: string;
  body: string;
  originalBody: string;
  intent: Intent;
  sentAt: string;
  source: SourceType;
  gmailMessageId?: string;
}
export interface DashboardStats {
  totalMessages: number; pendingDrafts: number; approvedDrafts: number; attentionRequired: number;
  messagesByIntent: Record<Intent, number>; recentActivity: Activity[]; lastSyncedAt: string | null;
}
