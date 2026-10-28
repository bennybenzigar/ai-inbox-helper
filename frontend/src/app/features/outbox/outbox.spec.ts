import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { Outbox } from './outbox';

describe('Outbox Component', () => {
  let component: Outbox;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Outbox],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    const fixture = TestBed.createComponent(Outbox);
    component = fixture.componentInstance;
  });

  it('should initialize with empty state and default filters', () => {
    expect(component).toBeTruthy();
    expect(component.items().length).toBe(0);
    expect(component.selectedIntent()).toBe('all');
    expect(component.search()).toBe('');
    expect(component.selectedIds().size).toBe(0);
    expect(component.previewItem()).toBeNull();
  });
});
