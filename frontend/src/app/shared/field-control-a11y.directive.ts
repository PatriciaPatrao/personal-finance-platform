import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  inject,
} from '@angular/core';

/**
 * Applies aria-describedby and aria-invalid to the focusable control inside
 * the host (native input or PrimeNG Select combobox).
 */
@Directive({
  selector: 'input[pfpFieldControl], p-select[pfpFieldControl]',
})
export class FieldControlA11y implements OnChanges, AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Id of the visible field error element, or null when valid. */
  @Input() pfpFieldErrorId: string | null = null;

  ngOnChanges(): void {
    this.sync();
  }

  ngAfterViewInit(): void {
    this.sync();
  }

  private sync(): void {
    const host = this.host.nativeElement;
    const control = this.resolveControl(host);
    if (!control) {
      return;
    }

    if (this.pfpFieldErrorId) {
      control.setAttribute('aria-describedby', this.pfpFieldErrorId);
      control.setAttribute('aria-invalid', 'true');
    } else {
      control.removeAttribute('aria-describedby');
      control.removeAttribute('aria-invalid');
    }
  }

  private resolveControl(host: HTMLElement): HTMLElement | null {
    if (
      host instanceof HTMLInputElement ||
      host instanceof HTMLSelectElement ||
      host instanceof HTMLTextAreaElement
    ) {
      return host;
    }

    return host.querySelector<HTMLElement>(
      '[role="combobox"], input:not([type="hidden"])',
    );
  }
}
