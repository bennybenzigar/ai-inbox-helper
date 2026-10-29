import { Component, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { ApiService } from "../../core/services/api.service";
import { EventService } from "../../core/services/event.service";
import { InboxStateService } from "../../core/services/inbox-state.service";
import { PaginationService } from "../../core/services/pagination.service";
import { ToastService } from "../../core/services/toast.service";
import { StatCard } from "../../shared/components/stat-card/stat-card";
import { IntentBadge } from "../../shared/components/intent-badge/intent-badge";
import { Paginator } from "../../shared/components/paginator/paginator";
import { INTENTS } from "../../core/models/inbox.models";
import { environment } from "../../../environments/environment";

@Component({
  standalone: true,
  selector: "app-dashboard",
  imports: [RouterLink, StatCard, IntentBadge, DatePipe, Paginator],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.scss",
})
export class Dashboard implements OnInit, OnDestroy {
  readonly Math = Math;
  private api = inject(ApiService);
  private events = inject(EventService);
  private toast = inject(ToastService);
  readonly state = inject(InboxStateService);
  readonly pager = inject(PaginationService);
  readonly intents = INTENTS;
  readonly uploading = signal(false);
  readonly message = signal("");
  readonly page = signal(1);
  readonly exportCsvUrl = `${environment.apiBaseUrl}/api/messages/export-csv`;
  private eventSub?: Subscription;

  downloadExport(): void {
    this.api.downloadCsvFromUrl(this.exportCsvUrl, 'candidate_messages_export.csv');
  }

  readonly pagedMessages = computed(() => {
    const all = this.state.messages();
    const size = this.pager.pageSize();
    const start = (this.page() - 1) * size;
    return all.slice(start, start + size);
  });

  ngOnInit() {
    this.refresh();
    this.eventSub = this.events.events.subscribe((e) => {
      if (e.type === 'messages-updated' || e.type === 'draft-updated') {
        this.refresh();
      }
    });
  }

  ngOnDestroy() {
    this.eventSub?.unsubscribe();
  }

  refresh() {
    this.page.set(1);
    this.api.getDashboard().subscribe({
      next: (r) => this.state.stats.set(r.stats),
      error: () => this.message.set("Backend unavailable. Start the backend on port 3000."),
    });
    this.api.getMessages().subscribe({
      next: (r) => this.state.setMessages(r.items),
      error: () => {},
    });
    this.api.getDrafts().subscribe({
      next: (r) => this.state.drafts.set(r.items),
      error: () => {},
    });
  }

  onCsvFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const csv = reader.result as string;
      if (!csv || !csv.trim()) {
        const msg = "Selected CSV file is empty. Please upload a file with valid candidate messages.";
        this.message.set(msg);
        this.toast.error(msg);
        input.value = "";
        return;
      }
      this.uploading.set(true);
      this.api.uploadMessagesCSV(csv).subscribe({
        next: (res) => {
          this.uploading.set(false);
          this.message.set(`Imported ${res.imported} candidate messages from CSV.`);
          this.toast.success(`Imported ${res.imported} candidate messages from CSV.`);
          input.value = "";
          this.refresh();
        },
        error: (err) => {
          this.uploading.set(false);
          const msg = err.error?.error || "Failed to upload messages CSV.";
          this.message.set(msg);
          this.toast.error(msg);
          input.value = "";
        },
      });
    };
    reader.readAsText(file);
  }
}
