import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'aih_page_size';

@Injectable({ providedIn: 'root' })
export class PaginationService {
  readonly pageSize = signal<number>(
    parseInt(localStorage.getItem(STORAGE_KEY) ?? '10', 10)
  );

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, String(this.pageSize()));
    });
  }

  setPageSize(n: number): void {
    this.pageSize.set(n);
  }
}
