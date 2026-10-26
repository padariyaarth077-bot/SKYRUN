import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BudgetScope =
  "lead" | "ride" | "chat_start" | "chat_read" | "chat_write" | "acceptance";
export function budgetSubject(request: Request, secret: string) {
  // Only Cloudflare runtime metadata authorizes its overwritten IP header.
  const ip = (request as Request & { cf?: unknown }).cf
    ? request.headers.get("cf-connecting-ip")
    : null;
  // shortcut: missing trusted IP shares one budget; verify CF metadata before rollout.
  const identity = ip && isIP(ip) ? `ip/${ip}` : "unattributed";
  return createHmac("sha256", secret)
    .update(new Date().toISOString().slice(0, 10) + "/" + identity)
    .digest("hex");
}
export async function enforcePublicBudget(scope: BudgetScope) {
  try {
    const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!secret) throw Error();
    const subject = budgetSubject(getRequest(), secret);
    const result = await supabaseAdmin.rpc("phase9_budget", { _subject: subject, _scope: scope });
    if (result.error || result.data !== true) throw Error();
  } catch {
    throw new Error("Request temporarily unavailable. Please wait and try again.");
  }
}
