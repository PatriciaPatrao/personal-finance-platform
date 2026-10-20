import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';

import { trapFocusWithin } from '../shared/focus-trap';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface CalendarDay {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  disabled: boolean;
  selected: boolean;
  today: boolean;
  label: string;
}

function formatIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toEuropeanDate(date: Date): string {
  const [year, month, day] = formatIso(date).split('-');
  return `${day}-${month}-${year}`;
}

function parseEuropeanDate(value: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

@Component({
  selector: 'app-date-field',
  imports: [Button, InputText],
  templateUrl: './date-field.html',
  styleUrl: './date-field.scss',
})
export class DateField implements OnDestroy {
  @Input({ required: true }) label = '';
  @Input({ required: true }) name = '';
  @Input() value = '';
  @Input() maxIsoDate: string | null = null;
  /** Id of the field error element shown below this control. */
  @Input() errorDescribedBy: string | null = null;
  @Input() invalid = false;
  @Input() required = false;
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  calendarDays: CalendarDay[] = [];
  readonly weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  private calendarFocusRelease: (() => void) | null = null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnDestroy(): void {
    this.releaseCalendarFocusTrap(false);
  }

  get inputId(): string {
    return `${this.name}-date`;
  }

  get calendarId(): string {
    return `${this.name}-calendar`;
  }

  get monthLabel(): string {
    return `${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`;
  }

  private buildDays(): CalendarDay[] {
    const firstOfMonth = new Date(this.viewYear, this.viewMonth, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(
      this.viewYear,
      this.viewMonth,
      1 - startOffset,
    );
    const input = this.host.nativeElement.querySelector('input');
    const typed = input instanceof HTMLInputElement ? input.value : this.value;
    const selected = parseEuropeanDate(typed) ?? parseEuropeanDate(this.value);
    const selectedIso = selected ? formatIso(selected) : null;
    const todayIso = formatIso(new Date());
    const days: CalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      const iso = formatIso(date);
      days.push({
        iso,
        dayNumber: date.getDate(),
        inMonth: date.getMonth() === this.viewMonth,
        disabled: this.maxIsoDate !== null && iso > this.maxIsoDate,
        selected: iso === selectedIso,
        today: iso === todayIso,
        label: `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
      });
    }

    return days;
  }

  private refreshDays(): void {
    this.calendarDays = this.buildDays();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }

  toggleCalendar(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.open) {
      this.closeCalendar();
      return;
    }

    this.open = true;
    this.syncViewToValue();
    this.refreshDays();
    queueMicrotask(() => this.activateCalendarFocusTrap());
  }

  closeCalendar(): void {
    if (!this.open && this.calendarFocusRelease === null) {
      return;
    }

    this.open = false;
    this.releaseCalendarFocusTrap(true);
  }

  previousMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
    } else {
      this.viewMonth -= 1;
    }
    this.refreshDays();
  }

  nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
    } else {
      this.viewMonth += 1;
    }
    this.refreshDays();
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled) {
      return;
    }

    const [year, month, dayNumber] = day.iso.split('-').map(Number);
    this.valueChange.emit(
      toEuropeanDate(new Date(year, month - 1, dayNumber)),
    );
    this.closeCalendar();
  }

  private activateCalendarFocusTrap(): void {
    if (!this.open) {
      return;
    }

    const calendar = this.host.nativeElement.querySelector(
      `#${this.calendarId}`,
    );
    if (!(calendar instanceof HTMLElement)) {
      return;
    }

    this.releaseCalendarFocusTrap(false);
    this.calendarFocusRelease = trapFocusWithin(calendar, {
      onEscape: () => this.closeCalendar(),
    });
  }

  private releaseCalendarFocusTrap(restoreInputFocus: boolean): void {
    if (!this.calendarFocusRelease) {
      if (restoreInputFocus) {
        this.focusDateInput();
      }
      return;
    }

    const release = this.calendarFocusRelease;
    this.calendarFocusRelease = null;
    release();
    if (restoreInputFocus) {
      this.focusDateInput();
    }
  }

  private focusDateInput(): void {
    const input = this.host.nativeElement.querySelector('input');
    if (input instanceof HTMLInputElement) {
      input.focus();
    }
  }

  private syncViewToValue(): void {
    const input = this.host.nativeElement.querySelector('input');
    const typed = input instanceof HTMLInputElement ? input.value : '';
    const parsed =
      parseEuropeanDate(typed) ??
      parseEuropeanDate(this.value) ??
      new Date();
    this.viewYear = parsed.getFullYear();
    this.viewMonth = parsed.getMonth();
  }
}
