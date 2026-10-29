import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCandidateMessagesCSV, importCandidateMessagesFromCSV } from '../src/services/csv-import.service';
import { parseAttendanceCSV, analyzeAttendance, generateSampleAttendanceCSV } from '../src/services/attendance.service';
import { parseHiringBoardCSV, analyzeStalledCandidates, generateSampleHiringBoardCSV } from '../src/services/stall-alerter.service';
import { InboxRepository } from '../src/repositories/inbox.repository';
import { newId } from '../src/utils/ids';
import type { Message, Draft } from '../src/models/types';

test('Option A CSV import: correctly parses candidate messages CSV', () => {
  const sample = `senderName,senderEmail,subject,body
Ananya Roy,ananya@example.com,Angular Developer Opening,"Hi, I would like to inquire about the Angular Developer position."`;
  const parsed = parseCandidateMessagesCSV(sample);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.senderName, 'Ananya Roy');
  assert.equal(parsed[0]?.subject, 'Angular Developer Opening');
});

test('Option A CSV import: stores messages, classifies intent, and creates drafts', async () => {
  const repo = new InboxRepository();
  const sample = `senderName,senderEmail,subject,body
Tariq Vance,tariq@example.com,Salary expectation,"Could you clarify the expected salary range for this role?"`;
  const result = await importCandidateMessagesFromCSV(repo, sample);
  assert.ok(result.imported >= 1);
  const messages = await repo.listMessages();
  const found = messages.find((m) => m.senderEmail === 'tariq@example.com');
  assert.ok(found);
  assert.equal(found.intent, 'Salary & Compensation');
  assert.equal(found.source, 'csv');
  const draft = await repo.getDraftForMessage(found.id);
  assert.ok(draft);
  assert.equal(draft.status, 'pending');
});

test('Option A: marks draft sent only after human approval', async () => {
  const repo = new InboxRepository();
  const now = new Date().toISOString();
  const msgId = newId();
  const draftId = newId();

  const msg: Message = {
    id: msgId,
    source: 'csv',
    senderName: 'Jane Candidate',
    senderEmail: 'jane.test@example.com',
    subject: 'Application follow-up',
    body: 'Checking on my status.',
    receivedAt: now,
    intent: 'Application Status',
    confidence: 0.9,
    status: 'pending',
    hasAttachments: false
  };
  await repo.insertMessage(msg);

  const draft: Draft = {
    id: draftId,
    messageId: msgId,
    body: 'Thank you for your message.',
    status: 'pending',
    isMock: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null
  };
  await repo.insertDraft(draft);

  // Sending while pending should fail
  assert.equal(await repo.markDraftSent(draftId), undefined);

  // Approve first (human review)
  const approved = await repo.reviewDraft(draftId, 'approved');
  assert.ok(approved);
  assert.equal(approved.status, 'approved');

  // Now sending succeeds
  const sent = await repo.markDraftSent(draftId);
  assert.ok(sent);
  assert.equal(sent.status, 'sent');
  const updatedMsg = await repo.getMessage(msgId);
  assert.equal(updatedMsg?.status, 'sent');
});

test('Option B Attendance Checker: flags overtime, missing hours, and consecutive leave with explanations', () => {
  const sample = generateSampleAttendanceCSV();
  const records = parseAttendanceCSV(sample);
  assert.ok(records.length > 5);

  const result = analyzeAttendance(records);
  assert.ok(result.flaggedCount > 0);
  assert.ok(result.summary.overtimeFlags > 0);
  assert.ok(result.summary.missingHourFlags > 0);
  assert.ok(result.summary.consecutiveLeaveFlags > 0);

  // Verify every flag has a non-empty explanation sentence
  for (const flag of result.flags) {
    assert.ok(flag.explanation.length > 10, `Flag ${flag.id} explanation must be descriptive`);
    assert.ok(flag.explanation.endsWith('.'), `Flag ${flag.id} explanation must end with period`);
  }
});

test('Attendance CSV parser: rejects empty files, title-only files, and blank comma rows', () => {
  const titleOnly = `employee_id,employee_name,date,hours_worked,leave_type`;
  assert.equal(parseAttendanceCSV(titleOnly).length, 0);

  const titleWithEmptyRows = `employee_id,employee_name,date,hours_worked,leave_type\n,,,,\n,,,,\n, , , , `;
  assert.equal(parseAttendanceCSV(titleWithEmptyRows).length, 0);

  const emptyString = '';
  assert.equal(parseAttendanceCSV(emptyString).length, 0);
});

test('Stall Alerter CSV parser: rejects empty files, title-only files, and blank comma rows', () => {
  const titleOnly = `candidate_id,candidate_name,candidate_email,role,stage,days_in_stage,last_activity_date,assigned_recruiter`;
  assert.equal(parseHiringBoardCSV(titleOnly).length, 0);

  const titleWithEmptyRows = `${titleOnly}\n,,,,,,,\n,,,,,,,\n, , , , , , , `;
  assert.equal(parseHiringBoardCSV(titleWithEmptyRows).length, 0);
});

test('Candidate Messages CSV parser: rejects empty files, title-only files, and blank comma rows', () => {
  const titleOnly = `senderName,senderEmail,subject,body`;
  assert.equal(parseCandidateMessagesCSV(titleOnly).length, 0);

  const titleWithEmptyRows = `senderName,senderEmail,subject,body\n,,,\n,,,\n, , , `;
  assert.equal(parseCandidateMessagesCSV(titleWithEmptyRows).length, 0);
});

test('Option C Stall Alerter: prioritizes stalled candidates by stage weight and days', () => {
  const sample = generateSampleHiringBoardCSV();
  const candidates = parseHiringBoardCSV(sample);
  assert.ok(candidates.length > 5);

  const result = analyzeStalledCandidates(candidates, 5);
  assert.ok(result.stalledCount > 0);

  // Highest priority alert must have rank 1 and a recommended action
  const topAlert = result.alerts[0];
  assert.ok(topAlert);
  assert.equal(topAlert.priorityRank, 1);
  assert.ok(topAlert.recommendedAction.length > 15);
  // Late stages like Offer Sent / Offer Pending should have Critical urgency
});

test('Backend Pagination & Filtering: listMessagesPaginated applies SQL search, intent filter, and pagination', async () => {
  const repo = new InboxRepository();
  const testId = newId();
  const msg: Message = {
    id: testId,
    source: 'csv',
    senderName: 'Backend Filter Test Candidate',
    senderEmail: 'backend.filter@example.com',
    subject: 'Unique Query Target Subject',
    body: 'Testing backend search query functionality.',
    receivedAt: new Date().toISOString(),
    intent: 'Job Details',
    confidence: 0.92,
    status: 'none',
    hasAttachments: false
  };
  await repo.insertMessage(msg);

  // Search by query
  const searchResult = await repo.listMessagesPaginated({ q: 'Unique Query Target', page: 1, limit: 10 });
  assert.ok(searchResult.total >= 1);
  assert.ok(searchResult.items.some(m => m.id === testId));
  assert.equal(searchResult.page, 1);
  assert.equal(searchResult.limit, 10);

  // Filter by matching intent
  const intentResult = await repo.listMessagesPaginated({ intent: 'Job Details', page: 1, limit: 5 });
  assert.ok(intentResult.items.every(m => m.intent === 'Job Details'));

  // Non-matching search query returns 0
  const emptyResult = await repo.listMessagesPaginated({ q: 'NonExistentString12345XYZ' });
  assert.equal(emptyResult.total, 0);
  assert.equal(emptyResult.items.length, 0);

  // Clean up
  await repo.deleteMessage(testId);
});

test('Backend Pagination & Filtering: listOutboxPaginated applies search and intent filtering', async () => {
  const repo = new InboxRepository();
  const msgId = newId();
  const draftId = newId();
  const now = new Date().toISOString();

  const msg: Message = {
    id: msgId,
    source: 'csv',
    senderName: 'Outbox Filter Candidate',
    senderEmail: 'outbox.filter@example.com',
    subject: 'Backend Outbox Test Subject',
    body: 'Original inquiry for outbox test.',
    receivedAt: now,
    intent: 'Interview Scheduling',
    confidence: 0.95,
    status: 'sent',
    hasAttachments: false
  };
  await repo.insertMessage(msg);

  const draft: Draft = {
    id: draftId,
    messageId: msgId,
    body: 'Sent response body text for outbox testing.',
    status: 'sent',
    isMock: false,
    version: 2,
    createdAt: now,
    updatedAt: now,
    reviewedAt: now
  };
  await repo.insertDraft(draft);

  // Test outbox search
  const outboxResult = await repo.listOutboxPaginated({ q: 'Outbox Filter Candidate', page: 1, limit: 10 });
  assert.ok(outboxResult.total >= 1);
  assert.ok(outboxResult.items.some(o => o.messageId === msgId));

  // Test outbox intent filter
  const intentResult = await repo.listOutboxPaginated({ intent: 'Interview Scheduling' });
  assert.ok(intentResult.items.every(o => o.intent === 'Interview Scheduling'));

  // Clean up
  await repo.deleteMessage(msgId);
});
