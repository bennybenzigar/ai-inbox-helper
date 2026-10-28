import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { IntentBadge } from './intent-badge';

describe('IntentBadge', () => {
  it('should initialize with default intent "Other / Unclear" and gray tone', () => {
    const fixture = TestBed.createComponent(IntentBadge);
    const comp = fixture.componentInstance;
    expect(comp.intent()).toBe('Other / Unclear');
    expect(comp.tone()).toBe('gray');
  });

  it('should return purple tone for Salary & Compensation', () => {
    const fixture = TestBed.createComponent(IntentBadge);
    fixture.componentRef.setInput('intent', 'Salary & Compensation');
    expect(fixture.componentInstance.tone()).toBe('purple');
  });

  it('should return green tone for Document Requests', () => {
    const fixture = TestBed.createComponent(IntentBadge);
    fixture.componentRef.setInput('intent', 'Document Requests');
    expect(fixture.componentInstance.tone()).toBe('green');
  });

  it('should return blue tone for Interview Scheduling', () => {
    const fixture = TestBed.createComponent(IntentBadge);
    fixture.componentRef.setInput('intent', 'Interview Scheduling');
    expect(fixture.componentInstance.tone()).toBe('blue');
  });

  it('should return blue tone for Job Details', () => {
    const fixture = TestBed.createComponent(IntentBadge);
    fixture.componentRef.setInput('intent', 'Job Details');
    expect(fixture.componentInstance.tone()).toBe('blue');
  });
});
