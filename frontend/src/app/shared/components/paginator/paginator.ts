import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-paginator',
  imports: [CommonModule],
  template: `
    @if(totalPages() > 1){
    <div class="paginator">
      <button class="page-btn" [disabled]="page() <= 1" (click)="go(page()-1)">‹ Prev</button>
      <span class="page-info">
        Page <strong>{{page()}}</strong> of <strong>{{totalPages()}}</strong>
        &nbsp;·&nbsp; {{total()}} total
      </span>
      <button class="page-btn" [disabled]="page() >= totalPages()" (click)="go(page()+1)">Next ›</button>
    </div>
    }
  `,
  styles: [`
    .paginator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 0 4px;
    }
    .page-btn {
      background: #fff;
      border: 1px solid #d0d9e6;
      border-radius: 7px;
      padding: 5px 14px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
      color: #3b4c6b;
      font-weight: 600;
    }
    .page-btn:hover:not([disabled]) {
      background: #eef3fb;
    }
    .page-btn[disabled] {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .page-info {
      font-size: 13px;
      color: #5a6a85;
    }
  `]
})
export class Paginator {
  readonly page    = input.required<number>();
  readonly total   = input.required<number>();
  readonly perPage = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.perPage())));

  go(n: number): void {
    if (n >= 1 && n <= this.totalPages()) this.pageChange.emit(n);
  }
}
