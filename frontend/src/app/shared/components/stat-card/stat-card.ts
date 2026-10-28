import { Component, input } from "@angular/core";
@Component({
  selector: "app-stat-card",
  standalone: true,
  template: `<article class="stat">
    <div class="stat-top">
      <span class="icon" [class]="'icon ' + tone()">{{ icon() }}</span
      ><span class="trend">{{ trend() }}</span>
    </div>
    <div class="label">{{ label() }}</div>
    <div class="value">{{ value() }}</div>
    <div class="hint">{{ hint() }}</div>
  </article>`,
  styles: [
    `
      .stat {
        background: #fff;
        border: 1px solid #e8edf4;
        border-radius: 13px;
        padding: 17px;
        min-width: 0;
      }
      .stat-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: #eaf2ff;
        color: #3977f6;
        font-size: 17px;
      }
      .icon.orange {
        background: #fff3e6;
        color: #ef9b35;
      }
      .icon.green {
        background: #e5f8ef;
        color: #12a879;
      }
      .icon.red {
        background: #ffeded;
        color: #e54c56;
      }
      .trend {
        font-size: 10px;
        color: #21a879;
      }
      .label {
        font-size: 12px;
        color: #758398;
      }
      .value {
        font-size: 28px;
        line-height: 1.2;
        font-weight: 750;
        color: #1b2b43;
        margin: 6px 0;
      }
      .hint {
        font-size: 10px;
        color: #8995a6;
      }
    `,
  ],
})
export class StatCard {
  label = input("");
  value = input<string | number>(0);
  icon = input("✉");
  tone = input("blue");
  trend = input("");
  hint = input("");
}
