import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FieldControlA11y } from './field-control-a11y.directive';

@Component({
  imports: [FieldControlA11y],
  template: `
    <input
      pfpFieldControl
      [pfpFieldErrorId]="errorId"
      aria-required="true"
    />
    @if (errorId) {
      <span [id]="errorId">Invalid value</span>
    }
  `,
})
class HostComponent {
  errorId: string | null = null;
}

describe('FieldControlA11y', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  it('should set aria attributes on a native input when invalid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.errorId = 'demo-error';
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('demo-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('should leave aria attributes unset when the field is valid', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });
});
