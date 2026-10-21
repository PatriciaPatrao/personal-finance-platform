import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

import { HouseholdService } from '../household/household.service';

/** Accept a household invitation after Auth0 sign-in. */
@Component({
  selector: 'app-join-household',
  standalone: true,
  template: `
    <main class="pfp-auth-status">
      @if (errorMessage) {
        <p>{{ errorMessage }}</p>
      } @else {
        <p>Joining household…</p>
      }
    </main>
  `,
})
export class JoinHousehold implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly households = inject(HouseholdService);

  errorMessage: string | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.errorMessage = 'Missing invitation token.';
      return;
    }
    this.auth.isAuthenticated$.subscribe((signedIn) => {
      if (!signedIn) {
        void this.auth.loginWithRedirect({
          appState: { target: `/join?token=${encodeURIComponent(token)}` },
        });
        return;
      }
      this.households.acceptInvitation(token).subscribe({
        next: () => {
          void this.router.navigateByUrl('/personal_finance');
        },
        error: () => {
          this.errorMessage =
            'This invitation is invalid, expired, or cannot be used.';
        },
      });
    });
  }
}
