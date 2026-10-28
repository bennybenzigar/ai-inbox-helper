import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get system status', () => {
    const mockStatus = {
      mode: 'demo',
      demoMode: true,
      gmail: {
        configured: false,
        connected: false,
        account: null,
        lastSyncedAt: null
      },
      aiProvider: 'mock',
      liveClients: 0
    };

    service.getStatus().subscribe((status) => {
      expect(status.mode).toBe('demo');
      expect(status.gmail.connected).toBe(false);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/status`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatus);
  });

  it('should query messages with encoded filters', () => {
    service
      .getMessages({ q: 'Alex', intent: 'Interview Scheduling' })
      .subscribe((res) => {
        expect(res.total).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/messages` &&
        r.params.get('q') === 'Alex' &&
        r.params.get('intent') === 'Interview Scheduling'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 1 });
  });

  it('should post draft approval with review action', () => {
    service.reviewDraft('draft-123', 'approve').subscribe((res) => {
      expect(res.note).toBe('Review recorded. No email was sent.');
    });

    const req = httpMock.expectOne(
      `${environment.apiBaseUrl}/api/drafts/draft-123/approve`
    );
    expect(req.request.method).toBe('POST');
    req.flush({
      draft: { id: 'draft-123', status: 'approved' },
      note: 'Review recorded. No email was sent.'
    });
  });

  it('should query messages with pagination params', () => {
    service
      .getMessages({ q: 'Alex', intent: 'Interview Scheduling', page: 2, limit: 10 })
      .subscribe((res) => {
        expect(res.total).toBe(25);
        expect(res.page).toBe(2);
        expect(res.limit).toBe(10);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/messages` &&
        r.params.get('q') === 'Alex' &&
        r.params.get('intent') === 'Interview Scheduling' &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it('should query outbox with pagination params', () => {
    service
      .getOutbox({ q: 'offer', intent: 'Salary & Compensation', page: 1, limit: 5 })
      .subscribe((res) => {
        expect(res.total).toBe(5);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiBaseUrl}/api/outbox` &&
        r.params.get('q') === 'offer' &&
        r.params.get('intent') === 'Salary & Compensation' &&
        r.params.get('page') === '1' &&
        r.params.get('limit') === '5'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], total: 5, page: 1, limit: 5, totalPages: 1 });
  });

  it('should construct correct export URLs with filters and pagination', () => {
    const messagesUrl = service.getMessagesExportUrl({ q: 'engineer', intent: 'Job Details', page: 1, limit: 10 });
    expect(messagesUrl).toContain('/api/messages/export-csv');
    expect(messagesUrl).toContain('q=engineer');
    expect(messagesUrl).toContain('page=1');
    expect(messagesUrl).toContain('limit=10');

    const outboxUrl = service.getOutboxExportUrl({ q: 'confirm' });
    expect(outboxUrl).toContain('/api/outbox/export-csv');
    expect(outboxUrl).toContain('q=confirm');
  });

  it('should call demo reset endpoint', () => {
    service.resetDemo().subscribe((res) => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/demo/data`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
  });
});
