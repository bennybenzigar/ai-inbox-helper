import { Routes } from "@angular/router";
export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "dashboard" },
  {
    path: "dashboard",
    loadComponent: () =>
      import("./features/dashboard/dashboard").then((m) => m.Dashboard),
  },
  {
    path: "inbox",
    loadComponent: () => import("./features/inbox/inbox").then((m) => m.Inbox),
  },
  {
    path: "outbox",
    loadComponent: () =>
      import("./features/outbox/outbox").then((m) => m.Outbox),
  },
  {
    path: "messages/:id",
    loadComponent: () =>
      import("./features/message-detail/message-detail").then(
        (m) => m.MessageDetail,
      ),
  },
  {
    path: "intents",
    loadComponent: () =>
      import("./features/intent-groups/intent-groups").then(
        (m) => m.IntentGroups,
      ),
  },
  {
    path: "gmail-connection",
    loadComponent: () =>
      import("./features/gmail-connection/gmail-connection").then(
        (m) => m.GmailConnection,
      ),
  },
  {
    path: "attendance",
    loadComponent: () =>
      import("./features/attendance/attendance").then(
        (m) => m.AttendanceComponent,
      ),
  },
  {
    path: "stall-alerter",
    loadComponent: () =>
      import("./features/stall-alerter/stall-alerter").then(
        (m) => m.StallAlerterComponent,
      ),
  },
  {
    path: "settings",
    loadComponent: () =>
      import("./features/settings/settings").then((m) => m.Settings),
  },
  { path: "**", redirectTo: "dashboard" },
];
