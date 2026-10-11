import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CopyTable, tableToText } from './copy-table';

@Component({
  imports: [CopyTable],
  template: `
    <app-copy-table>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rent</td>
            <td>€10.00</td>
            <td>
              <button type="button">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </app-copy-table>
  `,
})
class CopyTableHost {}

describe('CopyTable', () => {
  let fixture: ComponentFixture<CopyTableHost>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CopyTableHost],
    }).compileComponents();

    fixture = TestBed.createComponent(CopyTableHost);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
  });

  it('should show an English copy tooltip on the table', () => {
    const button = compiled.querySelector('.copy-button') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe('Copy table');
    expect(compiled.querySelector('.copy-tooltip')).toBeNull();

    button.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(compiled.querySelector('.copy-tooltip')?.textContent?.trim()).toBe(
      'Copy table',
    );
  });

  it('should copy table text without the actions column', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const button = compiled.querySelector('.copy-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith('Name\tAmount\nRent\t€10.00');
    expect(compiled.querySelector('.copy-tooltip')?.textContent?.trim()).toBe(
      'Copied',
    );
  });

  it('should turn header and body cells into tab-separated text', () => {
    const table = compiled.querySelector('table') as HTMLTableElement;
    expect(tableToText(table)).toBe('Name\tAmount\nRent\t€10.00');
  });
});
