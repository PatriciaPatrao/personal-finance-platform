import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

import { HouseholdService } from './household.service';

/** Owner workflow to invite another household member. */
@Component({
  selector: 'app-household-invite',
  standalone: true,
  imports: [Button, RouterLink],
  template: `
    <section class="pfp-page">
      <h1>Household members</h1>
      <p>
        Create a time-limited invitation link for someone who should share
        this household. They must sign in with Auth0 before the link expires.
      </p>
      @if (role() !== 'owner') {
        <p>Only the household owner can create invitations.</p>
      } @else {
        <p-button
          label="Create invitation link"
          (onClick)="createInvite()"
          [loading]="creating()"
        />
        @if (inviteLink()) {
          <p>
            <strong>Invitation link</strong> (share securely; expires
            {{ expiresAt() }}):
          </p>
          <code>{{ inviteLink() }}</code>
        }
      }
      <p><a routerLink="/personal_finance">Back to dashboard</a></p>
    </section>
  `,
})
export class HouseholdInvite implements OnInit {
  private readonly households = inject(HouseholdService);

  readonly role = signal<string | null>(null);
  readonly inviteLink = signal<string | null>(null);
  readonly expiresAt = signal<string | null>(null);
  readonly creating = signal(false);

  ngOnInit(): void {
    this.households.getMe().subscribe({
      next: (me) => this.role.set(me.role),
    });
  }

  createInvite(): void {
    this.creating.set(true);
    this.households.createInvitation().subscribe({
      next: (created) => {
        const token = encodeURIComponent(created.token);
        this.inviteLink.set(
          `${window.location.origin}/join?token=${token}`,
        );
        this.expiresAt.set(
          new Date(created.expires_at).toLocaleString(),
        );
        this.creating.set(false);
      },
      error: () => {
        this.creating.set(false);
      },
    });
  }
}
