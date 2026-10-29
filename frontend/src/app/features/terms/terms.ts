import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-terms',
  imports: [CommonModule, RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.scss'
})
export class TermsComponent {
  readonly lastUpdated = 'October 29, 2026';
}

