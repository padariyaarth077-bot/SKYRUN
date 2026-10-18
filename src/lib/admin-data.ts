import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

export type Lead = {
  id: string;
  lead_number: string;
  status: LeadStatus;
  priority: string;
  source: string;
  subject: string | null;
  created_at: string;
  customers: { full_name: string; email: string | null; phone: string | null } | null;
};

// Range reads avoid silently treating PostgREST's default row cap as the total.
export async function readAll<T>(
  read: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await read(start, start + 499);
    if (error) throw new Error("Could not load records. Please retry.");
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export const LEAD_SOURCES = [
  "CONTACT_FORM",
  "RIDE_ENQUIRY",
  "CHATBOT",
  "PHONE",
  "EMAIL",
  "ADMIN",
  "PARTNER",
] as const;
export const ALL_LEAD_STATUSES: LeadStatus[] = [
  "NEW",
  "REVIEWING",
  "GENUINE",
  "CONTACTED",
  "QUALIFIED",
  "QUOTE_REQUESTED",
  "QUOTE_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
  "SPAM",
];
export function matchesLeadStatus(status: string, filter?: string) {
  return (
    !filter ||
    (filter === "NEEDS_REVIEW" ? ["NEW", "REVIEWING"].includes(status) : status === filter)
  );
}

export async function fetchLeads(): Promise<Lead[]> {
  try {
    return await readAll<Lead>((start, end) =>
      supabase
        .from("leads")
        .select(
          "id,lead_number,status,priority,source,subject,created_at,customers(full_name,email,phone)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, end),
    );
  } catch {
    throw new Error("Could not load leads. Please retry.");
  }
}

export async function setLeadStatus(
  leadId: string,
  status: LeadStatus,
  actorId: string,
  reason?: string,
) {
  if (!ALL_LEAD_STATUSES.includes(status)) throw new Error("Unsupported lead status.");
  let statusSaved = false;
  try {
    const current = await supabase.from("leads").select("status").eq("id", leadId).single();
    if (current.error || !current.data)
      throw new Error("Could not read this lead. Please refresh and retry.");
    if (current.data.status === status) return;
    const review = status === "GENUINE" || status === "SPAM";
    const { error, data } = await supabase
      .from("leads")
      .update({
        status,
        ...(review
          ? {
              reviewed_at: new Date().toISOString(),
              reviewed_by: actorId,
              spam_reason: status === "SPAM" ? reason?.trim() || null : null,
            }
          : {}),
      })
      .eq("id", leadId)
      .eq("status", current.data.status)
      .select("id")
      .single();
    if (error || !data)
      throw new Error("Could not save the lead status. Please refresh and retry.");
    statusSaved = true;
    const { error: activityError } = await supabase.rpc("log_activity", {
      _entity_type: "lead",
      _entity_id: leadId,
      _activity_type: "STATUS_CHANGE",
      _description: `Marked as ${status}`,
      _metadata: { actor_id: actorId },
    });
    if (activityError)
      throw new Error("Status saved, but activity could not be recorded. Refresh before retrying.");
  } catch (error) {
    const safeMessages = [
      "Could not read this lead. Please refresh and retry.",
      "Could not save the lead status. Please refresh and retry.",
      "Status saved, but activity could not be recorded. Refresh before retrying.",
    ];
    if (error instanceof Error && safeMessages.includes(error.message)) throw error;
    throw new Error(statusSaved ? safeMessages[2] : safeMessages[1]);
  }
}
