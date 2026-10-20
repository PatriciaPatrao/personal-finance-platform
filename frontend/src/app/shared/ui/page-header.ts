import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="pfp-page-header">
      <h1>{{ title }}</h1>
      @if (intro) {
        <p class="pfp-page-intro">{{ intro }}</p>
      }
      <ng-content />
    </header>
  `,
})
export class PageHeader {
  @Input({ required: true }) title = '';
  @Input() intro: string | null = null;
}
