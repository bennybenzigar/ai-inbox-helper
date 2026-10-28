import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { InboxStateService } from './inbox-state.service';
import { InboxMessage, Draft } from '../models/inbox.models';

describe('InboxStateService', () => {
  let service: InboxStateService;

  const mockMessage: InboxMessage = {
    id: 'msg-1',
    source: 'demo',
    senderName: 'Jane Doe',
    senderEmail: 'jane@example.com',
    subject: 'Interview Schedule Availability',
    body: 'I am available on Thursday for the interview.',
    receivedAt: '2026-10-27T10:00:00.000Z',
    intent: 'Interview Scheduling',
    confidence: 0.95,
    status: 'none',
    hasAttachments: false
  };

  const mockDraft: Draft = {
    id: 'draft-1',
    messageId: 'msg-1',
    body: 'Hi Jane, thank you for sharing your availability.',
    status: 'pending',
    isMock: true,
    version: 1,
    createdAt: '2026-10-27T10:05:00.000Z',
    updatedAt: '2026-10-27T10:05:00.000Z',
    reviewedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InboxStateService);
  });

  it('should initialize with empty state', () => {
    expect(service.messages()).toEqual([]);
    expect(service.drafts()).toEqual([]);
    expect(service.search()).toBe('');
    expect(service.selectedIntent()).toBe('all');
    expect(service.selectedStatus()).toBe('all');
  });

  it('should update messages and reflect in filteredMessages', () => {
    service.setMessages([mockMessage]);
    expect(service.messages().length).toBe(1);
    expect(service.filteredMessages().length).toBe(1);
  });

  it('should filter messages by search query', () => {
    service.setMessages([mockMessage]);
    service.search.set('Jane');
    expect(service.filteredMessages().length).toBe(1);

    service.search.set('Unknown Candidate');
    expect(service.filteredMessages().length).toBe(0);
  });

  it('should filter messages by intent', () => {
    service.setMessages([mockMessage]);
    service.selectedIntent.set('Interview Scheduling');
    expect(service.filteredMessages().length).toBe(1);

    service.selectedIntent.set('Salary & Compensation');
    expect(service.filteredMessages().length).toBe(0);
  });

  it('should upsert draft and update message status', () => {
    service.setMessages([mockMessage]);
    service.upsertDraft(mockDraft);

    expect(service.drafts().length).toBe(1);
    expect(service.pendingDrafts().length).toBe(1);
    expect(service.messages()[0].status).toBe('pending');
  });
});
