const PIXEL_ID = "2119911498694460";
const CONSENT_KEY = "skyrun-cookie-consent-v1";
const LEAD_PREFIX = "skyrun-meta-lead:";
let lastPageViewRoute = "";
const hasGlobalPrivacyControl = () =>
  (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

type PixelFunction = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
  push?: (...args: unknown[]) => void;
  version?: string;
};
declare global {
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
    __skyrunPixelInitialized?: boolean;
  }
}

export function hasMarketingConsent() {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "accepted" && !hasGlobalPrivacyControl();
  } catch {
    return false;
  }
}

export function getMarketingConsentChoice() {
  try {
    if (hasGlobalPrivacyControl()) return "rejected";
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function saveMarketingConsent(accepted: boolean) {
  try {
    const allow = accepted && !hasGlobalPrivacyControl();
    window.localStorage.setItem(CONSENT_KEY, allow ? "accepted" : "rejected");
    if (allow) {
      if (window.__skyrunPixelInitialized) window.fbq?.("consent", "grant");
    } else {
      window.fbq?.("consent", "revoke");
      document.cookie = "_fbp=; Max-Age=0; path=/; SameSite=Lax";
      document.cookie = `_fbp=; Max-Age=0; path=/; domain=${location.hostname}; SameSite=Lax`;
      document.cookie = `_fbp=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
    }
  } catch {
    // If consent cannot be stored, keep the optional pixel disabled.
  }
}

function initializePixel() {
  if (!hasMarketingConsent()) return null;
  let fbq = window.fbq;
  if (!fbq) {
    fbq = function (...args: unknown[]) {
      if (fbq!.callMethod) fbq!.callMethod.apply(fbq, args);
      else (fbq!.queue ??= []).push(args);
    } as PixelFunction;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = fbq;
  }
  if (!document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if (!window.__skyrunPixelInitialized) {
    fbq("consent", "grant");
    fbq("init", PIXEL_ID);
    window.__skyrunPixelInitialized = true;
  }
  return fbq;
}

export function trackPageView(routeKey: string) {
  if (!hasMarketingConsent()) return;
  if (lastPageViewRoute === routeKey) return;
  lastPageViewRoute = routeKey;
  initializePixel()?.("track", "PageView");
}

export function trackLead(reference: string) {
  if (!reference || !hasMarketingConsent()) return;
  try {
    const key = `${LEAD_PREFIX}${reference}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
  initializePixel()?.("track", "Lead");
}
