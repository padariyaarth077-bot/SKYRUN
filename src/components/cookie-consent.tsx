import { useEffect, useState } from "react";
import { getMarketingConsentChoice, saveMarketingConsent } from "@/lib/meta-pixel";
import { COOKIE_SETTINGS_EVENT, openCookieSettings } from "@/lib/cookie-settings";

export function CookieConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setChoice(getMarketingConsentChoice());
    const show = () => setOpen(true);
    window.addEventListener(COOKIE_SETTINGS_EVENT, show);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, show);
  }, []);

  if (choice && !open) return null;

  const choose = (accepted: boolean) => {
    saveMarketingConsent(accepted);
    setChoice(accepted ? "accepted" : "rejected");
    setOpen(false);
    window.dispatchEvent(new Event("skyrun:cookie-consent-updated"));
  };

  return (
    <aside className="cookie-consent" aria-label="Cookie preferences">
      <div>
        <strong>Cookie choices</strong>
        <p>
          Essential cookies keep the site working. Allow optional marketing cookies to measure
          Skyrun ad visits and enquiries.
        </p>
        <a href="/cookie-policy">Cookie policy</a>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="cookie-choice-secondary" onClick={() => choose(false)}>
          Reject optional
        </button>
        <button type="button" className="cookie-choice-primary" onClick={() => choose(true)}>
          Accept marketing
        </button>
      </div>
    </aside>
  );
}

export function CookieSettingsLink() {
  return (
    <button type="button" className="cookie-settings-link" onClick={openCookieSettings}>
      Cookie settings
    </button>
  );
}
