import { trapFocusWithin } from './focus-trap';

describe('trapFocusWithin', () => {
  it('returns focus to the previously focused element on release', () => {
    const container = document.createElement('section');
    const outside = document.createElement('button');
    const first = document.createElement('button');
    const second = document.createElement('button');
    outside.textContent = 'Outside';
    first.textContent = 'First';
    second.textContent = 'Second';
    document.body.append(outside, container);
    container.append(first, second);

    outside.focus();
    const release = trapFocusWithin(container);
    expect(document.activeElement).toBe(first);

    release();
    expect(document.activeElement).toBe(outside);

    container.remove();
    outside.remove();
  });
});
