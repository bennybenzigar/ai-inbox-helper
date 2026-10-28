import { Injectable, NgZone, inject, signal } from "@angular/core";
import { environment } from "../../../environments/environment";
import { Subject } from "rxjs";
@Injectable({ providedIn: "root" })
export class EventService {
  private readonly zone = inject(NgZone);
  private source: EventSource | null = null;
  readonly connected = signal(false);
  readonly events = new Subject<{ type: string; data: unknown }>();
  connect() {
    if (this.source) return;
    const source = new EventSource(`${environment.apiBaseUrl}/api/events`);
    this.source = source;
    source.onopen = () => this.zone.run(() => this.connected.set(true));
    source.onerror = () => this.zone.run(() => this.connected.set(false));
    source.onmessage = (e) =>
      this.zone.run(() => this.events.next({ type: "message", data: e.data }));
    for (const type of [
      "messages-updated",
      "draft-updated",
      "gmail-notification-received",
    ])
      source.addEventListener(type, (e) =>
        this.zone.run(() =>
          this.events.next({ type, data: (e as MessageEvent).data }),
        ),
      );
  }
  disconnect() {
    this.source?.close();
    this.source = null;
    this.connected.set(false);
  }
}
