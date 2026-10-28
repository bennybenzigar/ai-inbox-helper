import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { Sidebar } from './shared/components/sidebar/sidebar';
import { Header } from './shared/components/header/header';
import { ToastContainer } from './shared/components/toast-container/toast-container';
import { EventService } from './core/services/event.service';
import { ApiService } from './core/services/api.service';
@Component({ selector: 'app-root', standalone: true, imports: [RouterOutlet, Sidebar, Header, ToastContainer], templateUrl: './app.html', styleUrl: './app.scss' })
export class App implements OnInit, OnDestroy {
    private router = inject(Router); private events = inject(EventService); private api = inject(ApiService); private sub?: Subscription; title = 'Dashboard'; subtitle = 'Monitor candidate messages, AI draft status, and recent activity.'; section = 'Overview';
    private readonly pages: Record<string, { title: string; subtitle: string; section: string }> = { dashboard: { title: 'Dashboard', subtitle: 'Monitor candidate messages, AI draft status, and recent activity.', section: 'Overview' }, inbox: { title: 'Inbox', subtitle: 'View and manage candidate messages.', section: 'Workspace' }, outbox: { title: 'Sent Messages (Outbox)', subtitle: 'View and track all responses sent to candidates.', section: 'Workspace' }, intents: { title: 'Intent Groups', subtitle: 'Messages organized by candidate intent.', section: 'Workspace' }, 'gmail-connection': { title: 'Gmail Connection', subtitle: 'Connect Gmail to sync candidate messages.', section: 'Integrations' }, attendance: { title: 'Attendance Pattern Checker', subtitle: 'Detect unusual attendance anomalies and view single-sentence explanations.', section: 'Tools' }, 'stall-alerter': { title: 'Hiring Board Stall Alerter', subtitle: 'Identify stalled pipeline candidates and prioritize immediate follow-up actions.', section: 'Tools' }, settings: { title: 'Settings', subtitle: 'Manage preferences and candidate data.', section: 'Preferences' }, messages: { title: 'Message Details', subtitle: 'Review the original message and suggested reply.', section: 'Workspace' } };
    ngOnInit() { this.updateTitle(this.router.url); this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => this.updateTitle((e as NavigationEnd).urlAfterRedirects)); this.events.connect(); this.sub?.add(this.events.events.subscribe(e => { if (e.type === 'messages-updated' || e.type === 'draft-updated') { this.api.getMessages().subscribe(r => { }); } })); }
    private updateTitle(url: string) { const path = url.split('?')[0].split('/').filter(Boolean); const key = path[0] === 'messages' ? 'messages' : path[0] || 'dashboard'; const p = this.pages[key] ?? this.pages['dashboard']!; this.title = p.title; this.subtitle = p.subtitle; this.section = p.section; }
    ngOnDestroy() { this.sub?.unsubscribe(); this.events.disconnect(); }
}
