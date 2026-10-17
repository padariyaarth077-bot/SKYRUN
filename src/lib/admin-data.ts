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

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,lead_number,status,priority,source,subject,created_at,customers(full_name,email,phone)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load leads. Please retry.");
  return (data as Lead[]) ?? [];
}

export async function setLeadStatus(leadId: string, status: LeadStatus, actorId: string) {
  await supabase.from("leads").update({ status }).eq("id", leadId);
  await supabase.rpc("log_activity", {
    _entity_type: "lead",
    _entity_id: leadId,
    _activity_type: "STATUS_CHANGE",
    _description: `Marked as ${status}`,
    _metadata: { actor_id: actorId },
  });
}
