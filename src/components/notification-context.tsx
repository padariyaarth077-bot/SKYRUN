import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePolling } from "@/lib/use-polling";
import {
  defaultPreferences,
  notificationRoute,
  parsePreferences,
  shouldAlert,
  snapshotSchema,
  soundAllowed,
  type NotificationPreferences,
  type StaffNotification,
} from "@/lib/notifications";
import {
  closeNotificationAudio,
  playNotificationSound,
  unlockNotificationAudio,
} from "@/lib/notification-sound";
type State = {
  rows: StaffNotification[];
  unread: number | null;
  through: string;
  preferences: NotificationPreferences;
  error: string;
  refresh: () => Promise<void>;
  action: (action: string, id?: string, prefs?: NotificationPreferences) => Promise<boolean>;
};
const Context = createContext<State | null>(null);
export function useNotifications() {
  return useContext(Context);
}
export function NotificationProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [rows, setRows] = useState<StaffNotification[]>([]),
    [unread, setUnread] = useState<number | null>(null),
    [through, setThrough] = useState("0"),
    [preferences, setPreferences] = useState(defaultPreferences),
    [error, setError] = useState("");
  const busy = useRef(false),
    alive = useRef(true),
    generation = useRef(0),
    lastSeq = useRef<string | null>(null),
    seen = useRef(new Set<string>()),
    activeConversation = useRef<string | null>(null),
    mutating = useRef(false);
  const invalidate = useCallback(() => {
    alive.current = false;
    generation.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (busy.current || !alive.current) return;
    busy.current = true;
    const token = generation.current;
    try {
      const result = await supabase.rpc("phase8_snapshot");
      if (result.error) throw Error();
      const data = snapshotSchema.parse(result.data),
        prefs = parsePreferences(data.preferences);
      if (!alive.current || generation.current !== token) return;
      setRows(data.rows);
      setUnread(data.unread);
      setThrough(data.through);
      setPreferences(prefs);
      setError("");
      const previous = lastSeq.current;
      lastSeq.current = data.through;
      if (previous === null) return;
      let batchSound: StaffNotification["severity"] | undefined;
      for (const n of [...data.rows].reverse()) {
        if (n.read_at || BigInt(n.seq) <= BigInt(previous) || seen.current.has(n.id)) continue;
        seen.current.add(n.id);
        if (seen.current.size > 1000) seen.current.delete(seen.current.values().next().value!);
        const active = document.visibilityState === "visible" ? activeConversation.current : null;
        if (!shouldAlert(n, prefs, active)) continue;
        const announce = () => {
          if (!alive.current || generation.current !== token) return;
          const key = `skyrun-notifications/${userId}`;
          try {
            const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
            const ids = Array.isArray(saved)
              ? saved.filter((x) => typeof x === "string").slice(-999)
              : [];
            if (ids.includes(n.id)) return;
            localStorage.setItem(key, JSON.stringify([...ids, n.id]));
          } catch {
            /* Same-tab dedup still applies if storage is unavailable. */
          }
          const route = notificationRoute(n);
          toast(n.title, {
            id: n.id,
            description: n.severity,
            duration: 6000,
            action: route
              ? { label: "Open record", onClick: () => window.location.assign(route) }
              : undefined,
          });
          if (
            soundAllowed(n, prefs) &&
            (!batchSound ||
              ["NORMAL", "IMPORTANT", "URGENT"].indexOf(n.severity) >
                ["NORMAL", "IMPORTANT", "URGENT"].indexOf(batchSound))
          )
            batchSound = n.severity;
        };
        try {
          if (navigator.locks) await navigator.locks.request(`skyrun-alert/${userId}`, announce);
          else announce();
        } catch {
          announce();
        }
      }
      if (batchSound && alive.current && generation.current === token)
        playNotificationSound(batchSound, prefs.volume);
    } catch {
      if (alive.current && generation.current === token) {
        setError(
          "Notifications unavailable. Refresh to retry; check staff access and the approved Phase 8 database update.",
        );
        setRows([]);
        setUnread(null);
      }
    } finally {
      busy.current = false;
    }
  }, [userId]);
  useEffect(() => {
    alive.current = true;
    lastSeq.current = null;
    seen.current.clear();
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        invalidate();
        setRows([]);
        setUnread(null);
        toast.dismiss();
        closeNotificationAudio();
      }
    });
    const focus = () => void refresh(),
      conversation = (e: Event) => {
        activeConversation.current = (e as CustomEvent<string | null>).detail;
      };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    window.addEventListener("skyrun-active-conversation", conversation);
    return () => {
      invalidate();
      data.subscription.unsubscribe();
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      window.removeEventListener("skyrun-active-conversation", conversation);
      toast.dismiss();
      closeNotificationAudio();
    };
  }, [refresh, invalidate]);
  const audioReady = unread !== null;
  useEffect(() => {
    if (!preferences.sound || !audioReady) return;
    const unlock = () => {
      void unlockNotificationAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [preferences.sound, audioReady]);
  usePolling(refresh, true, 5000);
  const action = async (kind: string, id?: string, prefs?: NotificationPreferences) => {
    if (mutating.current) return false;
    mutating.current = true;
    try {
      const result = await supabase.rpc("phase8_user_action", {
        _action: kind,
        _id: id ?? null,
        _through: through,
        _preferences: prefs ?? null,
      });
      if (result.error) throw Error();
      await refresh();
      return true;
    } catch {
      setError("Could not save notification changes. Your entries are preserved; retry safely.");
      return false;
    } finally {
      mutating.current = false;
    }
  };
  return (
    <Context.Provider value={{ rows, unread, through, preferences, error, refresh, action }}>
      {children}
      <Toaster closeButton position="bottom-right" />
    </Context.Provider>
  );
}
export function NotificationBell() {
  const state = useNotifications();
  return (
    <a
      href="/admin/m/notifications"
      aria-label={
        state?.unread === null
          ? "Notifications unavailable"
          : `Notifications${state?.unread ? `, ${state.unread} unread` : ""}`
      }
      title={state?.error || "Notifications"}
      className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted"
    >
      <Bell className="size-5" aria-hidden="true" />
      {Boolean(state?.unread) && (
        <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white">
          {state!.unread! > 99 ? "99+" : state!.unread}
        </span>
      )}
      {state?.error && <span className="absolute right-0 top-0 text-xs">!</span>}
    </a>
  );
}
