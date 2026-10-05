import { TestBed } from '@angular/core/testing';

import { DateField } from './date-field';

describe('DateField', () => {
  function createField(): {
    fixture: ReturnType<typeof TestBed.createComponent<DateField>>;
    component: DateField;
    values: string[];
  } {
    const fixture = TestBed.createComponent(DateField);
    const component = fixture.componentInstance;
    const values: string[] = [];
    component.label = 'From';
    component.name = 'from';
    component.value = '15-09-2026';
    component.maxIsoDate = '2026-09-20';
    component.valueChange.subscribe((value: string) => values.push(value));
    fixture.detectChanges();
    return { fixture, component, values };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateField],
    }).compileComponents();
  });

  it('should keep typed dates and still open a calendar', () => {
    const { fixture, component, values } = createField();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector('input') as HTMLInputElement;

    expect(input.placeholder).toBe('DD-MM-YYYY');
    expect(input.value).toBe('15-09-2026');

    input.value = '01-09-2026';
    input.dispatchEvent(new Event('input'));
    expect(values).toEqual(['01-09-2026']);

    (
      compiled.querySelector('.calendar-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(component.open).toBe(true);
    expect(compiled.querySelector('.month-label')?.textContent).toContain(
      'September 2026',
    );
  });

  it('should write the chosen day and close the calendar', () => {
    const { fixture, component, values } = createField();
    const compiled = fixture.nativeElement as HTMLElement;

    (
      compiled.querySelector('.calendar-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const day = compiled.querySelector(
      '[data-date="2026-09-01"]',
    ) as HTMLButtonElement;
    day.click();
    fixture.detectChanges();

    expect(values).toEqual(['01-09-2026']);
    expect(component.open).toBe(false);
  });

  it('should move between months and disable dates after the maximum', () => {
    const { fixture, component } = createField();
    const compiled = fixture.nativeElement as HTMLElement;

    (
      compiled.querySelector('.calendar-button') as HTMLButtonElement
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
});
