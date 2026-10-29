import { InboxRepository } from '../repositories/inbox.repository';
import { classifyIntent } from './intent.service';
import { createAIProvider } from './ai.service';
import { newId } from '../utils/ids';
import type { Message, Draft } from '../models/types';

export interface CSVMessageRow {
  senderName: string;
  senderEmail: string;
  subject: string;
  body: string;
}

export function parseCandidateMessagesCSV(csvText: string): CSVMessageRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const firstLine = lines[0] ?? '';
  const header = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const nameIdx = header.findIndex((h) => h.includes('name') || h.includes('sender') || h.includes('candidate'));
  const emailIdx = header.findIndex((h) => h.includes('email') || h.includes('mail'));
  const subjectIdx = header.findIndex((h) => h.includes('subject') || h.includes('title'));
  const bodyIdx = header.findIndex((h) => h.includes('body') || h.includes('message') || h.includes('content') || h.includes('text'));

  const rows: CSVMessageRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const row = rawLine.trim();
    if (!row) continue;

    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());

    if (cols.length < 2) continue;

    // Skip empty rows (e.g. ",,,,")
    if (cols.every((c) => !c)) continue;

    const rawName = (nameIdx !== -1 ? cols[nameIdx] : cols[0])?.trim() ?? '';
    const rawEmail = (emailIdx !== -1 ? cols[emailIdx] : cols[1])?.trim() ?? '';
    const rawSubject = (subjectIdx !== -1 ? cols[subjectIdx] : cols[2])?.trim() ?? '';
    const rawBody = (bodyIdx !== -1 ? cols[bodyIdx] : cols[3])?.trim() ?? '';

    // Disallow rows where essential data is absent
    if (!rawName && !rawEmail) continue;
    if (!rawSubject && !rawBody) continue;

    const senderName = (rawName || rawEmail).replace(/^["']|["']$/g, '');
    const senderEmail = (rawEmail || 'applicant@example.com').replace(/^["']|["']$/g, '');
    const subject = (rawSubject || rawBody).replace(/^["']|["']$/g, '');
    const body = (rawBody || rawSubject).replace(/^["']|["']$/g, '');

    rows.push({
      senderName: senderName.replace(/^["']|["']$/g, ''),
      senderEmail: senderEmail.replace(/^["']|["']$/g, ''),
      subject: subject.replace(/^["']|["']$/g, ''),
      body: body.replace(/^["']|["']$/g, '')
    });
  }

  return rows;
}

export async function importCandidateMessagesFromCSV(
  repo: InboxRepository,
  csvText: string
): Promise<{ imported: number; total: number }> {
  const rows = parseCandidateMessagesCSV(csvText);
  if (rows.length === 0) {
    throw new Error('CSV file did not contain any valid candidate message rows.');
  }

  const aiProvider = createAIProvider();
  let imported = 0;
  const now = new Date();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const { intent, confidence } = classifyIntent(row.subject, row.body);
    const msgId = newId();
    const receivedAt = new Date(now.getTime() - i * 15 * 60 * 1000).toISOString();

    const message: Message = {
      id: msgId,
      source: 'csv',
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      subject: row.subject,
      body: row.body,
      receivedAt,
      intent,
      confidence,
      status: 'pending',
      hasAttachments: false
    };

    await repo.insertMessage(message);
    imported++;

    const draftBody = await aiProvider.generateDraft(message);
    const draft: Draft = {
      id: newId(),
      messageId: msgId,
      body: draftBody,
      status: 'pending',
      isMock: aiProvider.name === 'mock',
      version: 1,
      createdAt: receivedAt,
      updatedAt: receivedAt,
      reviewedAt: null
    };

    await repo.insertDraft(draft);
  }

  await repo.addActivity('csv-import', `Imported ${imported} candidate messages from CSV upload`);

  const allMessages = await repo.listMessages();
  return { imported, total: allMessages.length };
}

export function generateSampleCandidateMessagesCSV(): string {
  return `senderName,senderEmail,subject,body
Ananya Roy,ananya.roy@example.com,Angular Developer Opening,"Hi, I saw the Senior Angular Engineer role and would like to know if remote work is supported."
Tariq Vance,tariq.vance@example.com,Salary expectation,"Could you clarify the expected salary band and equity component for the Staff Backend position?"
Elena Rostova,elena.rostova@example.com,Interview Availability,"I am confirmed for the technical interview this Thursday at 2 PM EST."
David Miller,david.miller@example.com,Application Status Update,"Following up on my onsite interview last week for the DevOps Architect role."
Priya Sharma,priya.sharma@example.com,Degree certificate and transcripts,"Please find my updated academic transcripts and reference letters as requested."
`;
}
