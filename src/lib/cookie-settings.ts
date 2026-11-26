export const COOKIE_SETTINGS_EVENT = "skyrun:cookie-settings";

export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
