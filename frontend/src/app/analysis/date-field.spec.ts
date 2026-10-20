import { TestBed } from '@angular/core/testing';

import { DateField } from './date-field';

describe('DateField', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateField],
    }).compileComponents();
  });

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }

  async function openCalendar(
    fixture: ReturnType<typeof TestBed.createComponent<DateField>>,
    compiled: HTMLElement,
  ): Promise<void> {
    (
      compiled.querySelector('button.calendar-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    await flushMicrotasks();
  }

  function calendarFocusables(compiled: HTMLElement): HTMLElement[] {
    const calendar = compiled.querySelector('#from-calendar');
    if (!calendar) {
      return [];
    }

    return Array.from(
      calendar.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) => element.tabIndex !== -1 && !element.hasAttribute('disabled'),
    );
  }

  function setup(value = '15-09-2026'): {
    fixture: ReturnType<typeof TestBed.createComponent<DateField>>;
    component: DateField;
    values: string[];
    compiled: HTMLElement;
  } {
    const fixture = TestBed.createComponent(DateField);
    const component = fixture.componentInstance;
    const values: string[] = [];
    component.label = 'From';
    component.name = 'from';
    component.value = value;
    component.maxIsoDate = '2026-09-20';
    component.valueChange.subscribe((next: string) => values.push(next));
    fixture.detectChanges();
    return {
      fixture,
      component,
      values,
      compiled: fixture.nativeElement as HTMLElement,
    };
  }

  it('should keep a typed date and open the calendar on that month', () => {
    const { fixture, component, values, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;

    expect(input.placeholder).toBe('DD-MM-YYYY');
    expect(input.value).toBe('15-09-2026');

    input.value = '01-09-2026';
    input.dispatchEvent(new Event('input'));
    expect(values).toEqual(['01-09-2026']);

    (
      compiled.querySelector('button.calendar-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(component.open).toBe(true);
    expect(compiled.querySelector('.month-label')?.textContent).toContain(
      'September 2026',
    );
  });

  it('should write the chosen day and close the calendar', async () => {
    const { fixture, component, values, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;
    input.focus();

    await openCalendar(fixture, compiled);
    (
      compiled.querySelector('[data-date="2026-09-01"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(values).toEqual(['01-09-2026']);
    expect(component.open).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('should move focus into the calendar when it opens', async () => {
    const { fixture, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;
    input.focus();

    await openCalendar(fixture, compiled);

    const focusables = calendarFocusables(compiled);
    expect(focusables.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(focusables[0]);
  });

  it('should wrap Tab and Shift+Tab within the open calendar', async () => {
    const { fixture, compiled } = setup();
    await openCalendar(fixture, compiled);

    const focusables = calendarFocusables(compiled);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    last.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    );
    expect(document.activeElement).toBe(first);

    first.focus();
    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(document.activeElement).toBe(last);
  });

  it('should close on Escape and restore focus to the date input', async () => {
    const { fixture, component, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;
    input.focus();

    await openCalendar(fixture, compiled);
    const focusables = calendarFocusables(compiled);
    focusables[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.open).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('should ignore Escape when the calendar is closed', () => {
    const { component } = setup();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(component.open).toBe(false);
  });

  it('should close from the backdrop and restore focus to the date input', async () => {
    const { fixture, component, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;
    input.focus();

    await openCalendar(fixture, compiled);
    (
      compiled.querySelector('.calendar-backdrop') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(component.open).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('should not accumulate focus handlers across repeated open cycles', async () => {
    const { fixture, component, compiled } = setup();
    const input = compiled.querySelector('input') as HTMLInputElement;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      input.focus();
      await openCalendar(fixture, compiled);
      const focusables = calendarFocusables(compiled);
      focusables[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      expect(component.open).toBe(false);
      expect(document.activeElement).toBe(input);
    }
  });

  it('should release the focus trap when destroyed while open', async () => {
    const { fixture, compiled } = setup();
    await openCalendar(fixture, compiled);
    expect(fixture.componentInstance.open).toBe(true);
    fixture.destroy();
  });

  it('should move between months and disable dates after the maximum', () => {
    const { fixture, component, compiled } = setup();

    (
      compiled.querySelector('button.calendar-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const blocked = compiled.querySelector(
      '[data-date="2026-09-21"]',
    ) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);

    (
      compiled.querySelector(
        'button[aria-label="Next month"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(component.monthLabel).toBe('October 2026');

    (
      compiled.querySelector(
        'button[aria-label="Previous month"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(component.monthLabel).toBe('September 2026');
  });

  it('should expose validation state on the text input', () => {
    const fixture = TestBed.createComponent(DateField);
    const component = fixture.componentInstance;
    component.label = 'Start date';
    component.name = 'startDate';
    component.value = '';
    component.errorDescribedBy = 'start-date-error';
    component.invalid = true;
    component.required = true;
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe('start-date-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
  });
});
