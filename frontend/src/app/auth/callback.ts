import { Component } from '@angular/core';

/** Auth0 OAuth redirect target (handled by the SDK). */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<p class="pfp-auth-status">Signing you in…</p>`,
})
export class AuthCallback {}
