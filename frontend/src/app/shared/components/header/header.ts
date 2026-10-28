import { Component, input } from "@angular/core";
import { UpperCasePipe } from "@angular/common";
@Component({
  selector: "app-header",
  standalone: true,
  template: `<header class="topbar">
    <div>
      <div class="eyebrow">WORKSPACE / {{ section() | uppercase }}</div>
      <h1>{{ title() }}</h1>
      <p>{{ subtitle() }}</p>
    </div>
    <div class="top-actions">
      <span class="connected"><i></i> PostgreSQL Live</span>
      <button type="button" class="avatar" aria-label="Profile">A</button>
    </div>
  </header>`,
  styles: [
    `
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 25px 32px 22px;
        border-bottom: 1px solid #e9eef5;
        background: #fff;
      }
      .eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1.1px;
        color: #8795a9;
      }
      h1 {
        font-size: 25px;
        letter-spacing: -0.6px;
        margin: 7px 0 5px;
        color: #15243a;
      }
      p {
        font-size: 12px;
        color: #7b899b;
        margin: 0;
      }
      .top-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .connected {
        font-size: 11px;
        color: #187b5d;
        background: #e7f8f0;
        padding: 8px 11px;
        border-radius: 20px;
        white-space: nowrap;
      }
      .connected i {
        display: inline-block;
        width: 6px;
        height: 6px;
        background: #20b981;
        border-radius: 50%;
        margin-right: 5px;
      }
      .avatar {
        border: 0;
        background: #e8edff;
        color: #3755a5;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        font-weight: 700;
      }
      @media (max-width: 700px) {
        .topbar {
          padding: 18px;
          align-items: flex-start;
        }
        .top-actions {
          gap: 6px;
        }
        .connected {
          display: none;
        }
        h1 {
          font-size: 22px;
        }
      }
    `,
  ],
  imports: [UpperCasePipe],
})
export class Header {
  title = input("Dashboard");
  subtitle = input(
    "Monitor candidate messages, AI draft status, and recent activity.",
  );
  section = input("Overview");
}
