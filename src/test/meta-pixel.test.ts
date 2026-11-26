import { beforeEach, expect, it, vi } from "vitest";

import {
  getMarketingConsentChoice,
  hasMarketingConsent,
  saveMarketingConsent,
  trackLead,
  trackPageView,
} from "@/lib/meta-pixel";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.head
    .querySelectorAll('script[src="https://connect.facebook.net/en_US/fbevents.js"]')
    .forEach((script) => script.remove());
  delete window.fbq;
  delete window._fbq;
  delete window.__skyrunPixelInitialized;
  vi.resetModules();
});

it("does not load or send events without marketing consent", () => {
  trackPageView("/");
  trackLead("SR-123");
  expect(
    document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]'),
  ).toBeNull();
  expect(window.fbq).toBeUndefined();
});

it("loads once after consent and emits one PageView for each SPA route", async () => {
  saveMarketingConsent(true);
  const { trackPageView: track } = await import("@/lib/meta-pixel");
  track("/services");
  const fbq = window.fbq!;
  const queued = fbq.queue ?? [];
  expect(queued).toEqual([
    ["consent", "grant"],
    ["init", "2119911498694460"],
    ["track", "PageView"],
  ]);
  track("/services");
  track("/fleet");
  expect(fbq.queue).toEqual([
    ["consent", "grant"],
    ["init", "2119911498694460"],
    ["track", "PageView"],
    ["track", "PageView"],
  ]);
  expect(
    document.querySelectorAll('script[src="https://connect.facebook.net/en_US/fbevents.js"]'),
  ).toHaveLength(1);
});

it("sends a parameter-free Lead once per saved reference after consent", () => {
  saveMarketingConsent(true);
  trackLead("SR-456");
  trackLead("SR-456");
  expect(window.fbq?.queue).toEqual([
    ["consent", "grant"],
    ["init", "2119911498694460"],
    ["track", "Lead"],
  ]);
  expect(hasMarketingConsent()).toBe(true);
});

it("persists rejection and keeps the pixel disabled", () => {
  saveMarketingConsent(false);
  expect(getMarketingConsentChoice()).toBe("rejected");
  expect(hasMarketingConsent()).toBe(false);
  trackPageView("/");
  expect(window.fbq).toBeUndefined();
});

it("revokes Pixel consent when a visitor changes their choice", async () => {
  saveMarketingConsent(true);
  const { trackPageView: track } = await import("@/lib/meta-pixel");
  track("/services");
  const beforeRejection = window.fbq?.queue?.length;
  saveMarketingConsent(false);
  track("/fleet");
  expect(window.fbq?.queue?.slice(beforeRejection)).toEqual([["consent", "revoke"]]);
});
