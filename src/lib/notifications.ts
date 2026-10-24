import { z } from "zod";
export const eventKinds = [
  "RIDE_ENQUIRY",
  "CONTACT_MESSAGE",
  "CHAT_MESSAGE",
  "CHAT_HANDOFF",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "DEPOSIT_VERIFIED",
  "PAYMENT_EXCEPTION",
  "COMMUNICATION_FAILED",
] as const;
export const preferencesSchema = z
  .object({
    in_app: z.boolean(),
    sound: z.boolean(),
    volume: z.number().min(0).max(1),
    normal: z.boolean(),
    important: z.boolean(),
    urgent: z.boolean(),
    categories: z
      .record(z.boolean())
      .refine((value) =>
        Object.keys(value).every((key) => (eventKinds as readonly string[]).includes(key)),
      )
      .default({}),
    email_urgent: z.boolean(),
  })
  .strict();
export type NotificationPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: NotificationPreferences = {
  in_app: true,
  sound: true,
  volume: 0.35,
  normal: true,
  important: true,
  urgent: true,
  categories: {},
  email_urgent: false,
};
export const notificationSchema = z.object({
  id: z.string().uuid(),
  seq: z.string().regex(/^\d+$/),
  business_unit_id: z.string().uuid(),
  kind: z.enum(eventKinds),
  severity: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
  title: z.string().max(160),
  entity_type: z.enum(["lead", "booking", "conversation"]),
  entity_id: z.string().uuid(),
  created_at: z.string(),
  read_at: z.string().nullable(),
});
export type StaffNotification = z.infer<typeof notificationSchema>;
export const snapshotSchema = z.object({
  rows: z.array(notificationSchema).max(50),
  unread: z.number().int().nonnegative(),
  through: z.string().regex(/^\d+$/),
  preferences: z.record(z.unknown()),
});
export function parsePreferences(value: Record<string, unknown>) {
  const { updated_at: _updated, ...saved } = value;
  return preferencesSchema.parse({ ...defaultPreferences, ...saved });
}
export function notificationRoute(n: Pick<StaffNotification, "entity_type" | "entity_id">) {
  if (!z.string().uuid().safeParse(n.entity_id).success) return null;
  return n.entity_type === "lead"
    ? `/admin/leads/${n.entity_id}`
    : n.entity_type === "booking"
      ? `/admin/booking/${n.entity_id}`
      : `/admin/chat-conversations?conversation=${n.entity_id}`;
}
export function shouldAlert(
  n: StaffNotification,
  p: NotificationPreferences,
  activeConversation: string | null,
) {
  return (
    p.in_app &&
    p.categories[n.kind] !== false &&
    !(n.kind === "CHAT_MESSAGE" && activeConversation === n.entity_id)
  );
}
export function soundAllowed(n: StaffNotification, p: NotificationPreferences) {
  return (
    p.sound && p.volume > 0 && p[n.severity.toLowerCase() as "normal" | "important" | "urgent"]
  );
}
export function retryEligible(
  c: {
    state: string;
    attempts: number;
    first_attempt_at: string | null;
    recipient: string | null;
    provider_email_id: string | null;
  },
  now = Date.now(),
) {
  return (
    c.state === "FAILED" &&
    c.attempts < 3 &&
    Boolean(c.recipient) &&
    !c.provider_email_id &&
    (!c.first_attempt_at || now - Date.parse(c.first_attempt_at) < 23 * 3600000)
  );
}
