import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-personal-finance-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './personal-finance-layout.html',
  styleUrl: './personal-finance-layout.scss'
})
export class PersonalFinanceLayout {
  skipToMain(): void {
    const main = document.getElementById('main-content');
    if (!main) {
      return;
    }

    queueMicrotask(() => {
      main.focus({ preventScroll: false });
    });
  }

  onSkipKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.skipToMain();
  }
}
