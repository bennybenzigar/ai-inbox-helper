import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.html',
  styleUrl: './loading-spinner.scss'
})
export class LoadingSpinner {
  @Input() text = 'Loading...';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
}
