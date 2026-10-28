import { Injectable, computed, signal } from "@angular/core";
import {
  DashboardStats,
  Draft,
  InboxMessage,
  Intent,
} from "../models/inbox.models";
@Injectable({ providedIn: "root" })
export class InboxStateService {
  readonly messages = signal<InboxMessage[]>([]);
  readonly drafts = signal<Draft[]>([]);
  readonly stats = signal<DashboardStats | null>(null);
  readonly selectedMessageId = signal<string | null>(null);
  readonly search = signal("");
  readonly selectedIntent = signal("all");
  readonly selectedStatus = signal("all");
  readonly loading = signal(false);
  readonly error = signal("");
  readonly total = signal(0);
  readonly filteredMessages = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.messages().filter(
      (m) =>
        (!q ||
          `${m.senderName} ${m.senderEmail} ${m.subject} ${m.body}`
            .toLowerCase()
            .includes(q)) &&
        (this.selectedIntent() === "all" ||
          m.intent === this.selectedIntent()) &&
        (this.selectedStatus() === "all" || m.status === this.selectedStatus()),
    );
  });
  readonly pendingDrafts = computed(() =>
    this.drafts().filter((d) => d.status === "pending"),
  );
  setMessages(items: InboxMessage[], total?: number) {
    this.messages.set(items);
    this.total.set(total !== undefined ? total : items.length);
  }
  upsertDraft(draft: Draft) {
    this.drafts.update((items) => [
      draft,
      ...items.filter((d) => d.id !== draft.id),
    ]);
    this.messages.update((items) =>
      items.map((m) =>
        m.id === draft.messageId ? { ...m, status: draft.status } : m,
      ),
    );
  }
}
