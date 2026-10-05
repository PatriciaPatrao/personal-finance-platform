import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

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
  templateUrl: './date-field.html',
  styleUrl: './date-field.scss',
})
export class DateField {
  @Input({ required: true }) label = '';
  @Input({ required: true }) name = '';
  @Input() value = '';
  @Input() maxIsoDate: string | null = null;
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();
  readonly weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  constructor(private host: ElementRef<HTMLElement>) {}

  get inputId(): string {
    return `${this.name}-date`;
  }

  get calendarId(): string {
    return `${this.name}-calendar`;
  }

  get monthLabel(): string {
    return `${MONTH_NAMES[this.viewMonth]} ${this.viewYear}`;
  }

  get days(): CalendarDay[] {
    const firstOfMonth = new Date(this.viewYear, this.viewMonth, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(
      this.viewYear,
      this.viewMonth,
      1 - startOffset,
    );
    const selected = parseEuropeanDate(this.value);
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

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }

  toggleCalendar(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      this.syncViewToValue();
    }
  }

  previousMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
      return;
    }
    this.viewMonth -= 1;
  }

  nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
      return;
    }
    this.viewMonth += 1;
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled) {
      return;
    }

    const [year, month, dayNumber] = day.iso.split('-').map(Number);
    this.valueChange.emit(
      toEuropeanDate(new Date(year, month - 1, dayNumber)),
    );
    this.open = false;
  }

  @HostListener('document:mousedown', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.open) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!this.host.nativeElement.contains(target)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.open = false;
  }

  private syncViewToValue(): void {
    const parsed = parseEuropeanDate(this.value) ?? new Date();
    this.viewYear = parsed.getFullYear();
    this.viewMonth = parsed.getMonth();
  }
}
