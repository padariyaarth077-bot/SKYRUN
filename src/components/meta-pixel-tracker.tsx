import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { trackPageView } from "@/lib/meta-pixel";

export function MetaPixelTracker() {
  const routeKey = useLocation({
    select: (location) => `${location.pathname}${location.searchStr}`,
  });

  useEffect(() => {
    if (!/^\/(admin|auth|j1s30MRp_geRZtdPP860Rw|3ZiG4lFP04tFD1Iv4Vv97g)(\/|$)/.test(routeKey)) {
      trackPageView(routeKey);
    }
    const update = () => trackPageView(routeKey);
    window.addEventListener("skyrun:cookie-consent-updated", update);
    return () => window.removeEventListener("skyrun:cookie-consent-updated", update);
  }, [routeKey]);

  return null;
}
