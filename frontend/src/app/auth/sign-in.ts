import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

/** Starts Auth0 Universal Login when the user is not signed in. */
@Component({
  selector: 'app-sign-in',
  standalone: true,
  template: `<p class="pfp-auth-status">Redirecting to sign in…</p>`,
})
export class SignIn implements OnInit {
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    void this.auth.loginWithRedirect({
      appState: { target: '/personal_finance' },
    });
  }
}
