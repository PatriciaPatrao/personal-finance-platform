/** Product name used in browser document titles. */
export const APP_TITLE = 'Personal Finance Platform';

export function pageTitle(screen: string): string {
  return `${screen} — ${APP_TITLE}`;
}
