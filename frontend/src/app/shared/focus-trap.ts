const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.tabIndex !== -1 && !element.hasAttribute('disabled'),
  );
}

export type TrapFocusWithinOptions = {
  onEscape?: () => void;
};

export function trapFocusWithin(
  container: HTMLElement,
  options?: TrapFocusWithinOptions,
): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (options?.onEscape) {
        event.preventDefault();
        event.stopPropagation();
        options.onEscape();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const elements = focusableElements(container);
    if (elements.length === 0) {
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  const previous = document.activeElement as HTMLElement | null;
  focusableElements(container)[0]?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previous?.focus();
  };
}
