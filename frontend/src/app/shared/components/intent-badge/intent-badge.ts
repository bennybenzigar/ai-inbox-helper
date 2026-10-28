import { Component, input } from "@angular/core";
@Component({
  selector: "app-intent-badge",
  standalone: true,
  template: `<span class="badge" [class]="'badge ' + tone()">{{
    intent()
  }}</span>`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        border-radius: 6px;
        padding: 5px 8px;
        font-size: 10px;
        font-weight: 650;
        background: #eaf1ff;
        color: #3567d4;
      }
      .purple {
        background: #f0eaff;
        color: #8052d8;
      }
      .green {
        background: #e3f8ed;
        color: #188b62;
      }
      .orange {
        background: #fff2df;
        color: #b97613;
      }
      .red {
        background: #ffebeb;
        color: #cf4545;
      }
      .gray {
        background: #edf0f4;
        color: #64748b;
      }
    `,
  ],
})
export class IntentBadge {
  intent = input("Other / Unclear");
  tone() {
    const s = this.intent().toLowerCase();
    if (s.includes("salary")) return "purple";
    if (s.includes("document")) return "green";
    if (s.includes("application")) return "purple";
    if (s.includes("job")) return "blue";
    if (s.includes("other")) return "gray";
    return "blue";
  }
}
