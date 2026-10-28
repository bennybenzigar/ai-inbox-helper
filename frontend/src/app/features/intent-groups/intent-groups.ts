import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { EventService } from '../../core/services/event.service';
import { Intent } from '../../core/models/inbox.models';
@Component({
  standalone: true,
  selector: 'app-intent-groups',
  imports: [RouterLink],
  templateUrl: './intent-groups.html',
  styleUrl: './intent-groups.scss'
})
export class IntentGroups implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private events = inject(EventService);
  private eventSub?: Subscription;
  readonly groups = signal<{ intent: Intent; count: number }[]>([]);
  readonly error = signal('');
  readonly descriptions: Record<Intent, string> = {
    'Interview Scheduling': 'Coordinate interview times and availability.',
    'Application Status': 'Candidate follow-ups and hiring progress questions.',
    'Salary & Compensation': 'Compensation, salary range, and package discussions.',
    'Document Requests': 'CVs, certificates, references, and requested files.',
    'Job Details': 'Role responsibilities, requirements, and work arrangements.',
    'Other / Unclear': 'Messages that need closer human inspection.'
  };

  ngOnInit(): void {
    this.load();
    this.eventSub = this.events.events.subscribe((e) => {
      if (e.type === 'messages-updated') this.load();
    });
  }

  ngOnDestroy(): void {
    this.eventSub?.unsubscribe();
  }

  load(): void {
    this.api.getIntents().subscribe({
      next: (r) => this.groups.set(r.items),
      error: () =>
        this.error.set(
          'Backend unavailable. Start the backend on port 3000.'
        )
    });
  }
}

