import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
} from '@angular/core';

const COPIED_LABEL_MS = 2000;

export function tableToText(table: HTMLTableElement): string {
  const rows = Array.from(table.rows);
  const skip = new Set<number>();
  const header = rows[0];

  if (header) {
    Array.from(header.cells).forEach((cell, index) => {
      const label = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (label.toLowerCase() === 'actions') {
        skip.add(index);
      }
    });
  }

  return rows
    .map((row) =>
      Array.from(row.cells)
        .filter((_, index) => !skip.has(index))
        .map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())
        .join('\t'),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}

@Component({
  selector: 'app-copy-table',
  templateUrl: './copy-table.html',
  styleUrl: './copy-table.scss',
})
export class CopyTable implements OnDestroy {
  hovering = false;
  copied = false;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private host: ElementRef<HTMLElement>,
    private changeDetector: ChangeDetectorRef,
  ) {}

  get tooltip(): string {
    return this.copied ? 'Copied' : 'Copy table';
  }

  get showTooltip(): boolean {
    return this.hovering || this.copied;
  }

  ngOnDestroy(): void {
    if (this.copiedTimer !== null) {
      clearTimeout(this.copiedTimer);
    }
  }

  async copy(): Promise<void> {
    const table = this.host.nativeElement.querySelector('table');
    if (!table) {
      return;
    }

    const text = tableToText(table);
    if (!text) {
      return;
    }

    const wrote = await this.writeClipboard(text);
    if (!wrote) {
      return;
    }

    this.copied = true;
    this.changeDetector.detectChanges();
    if (this.copiedTimer !== null) {
      clearTimeout(this.copiedTimer);
    }
    this.copiedTimer = setTimeout(() => {
      this.copied = false;
      this.copiedTimer = null;
      this.changeDetector.detectChanges();
    }, COPIED_LABEL_MS);
  }

  private async writeClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return this.writeWithTextarea(text);
      }
    }

    return this.writeWithTextarea(text);
  }

  private writeWithTextarea(text: string): boolean {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    document.body.removeChild(area);
    return copied;
  }
}
