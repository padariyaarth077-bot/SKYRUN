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
  _actorId: string,
  reason?: string,
) {
  if (!ALL_LEAD_STATUSES.includes(status)) throw new Error("Unsupported lead status.");
  try {
    const current = await supabase.from("leads").select("status").eq("id", leadId).single();
    if (current.error || !current.data) throw Error();
    const result = await supabase.rpc("phase9_lead_status", {
      _id: leadId,
      _status: status,
      _expected: current.data.status,
      _reason: reason?.trim() || null,
    });
    if (result.error) throw Error();
  } catch {
    throw new Error("Could not save the lead status. Check permission, refresh and retry safely.");
  }
}
