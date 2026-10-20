import { useEffect, useRef } from "react";

// Schedule after completion rather than setInterval: slow requests never overlap.
export function usePolling(
  callback: () => Promise<unknown>,
  enabled: boolean,
  milliseconds = 5000,
) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        if (document.visibilityState !== "hidden") await latest.current();
      } catch {
        /* The caller displays its safe load error. */
      } finally {
        if (!cancelled) timer = setTimeout(tick, milliseconds);
      }
    };
    timer = setTimeout(tick, milliseconds);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, milliseconds]);
}
