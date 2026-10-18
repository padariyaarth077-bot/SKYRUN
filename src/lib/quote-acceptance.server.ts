import { createServerOnlyFn } from "@tanstack/react-start";
import { acceptanceTokenSchema } from "@/lib/quote-acceptance.shared";

export const hashAcceptanceToken = createServerOnlyFn(async (token: string) => {
  acceptanceTokenSchema.parse(token);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
});

// Internal issuance helper, not an endpoint. Only the hash belongs in the database.
// The approved delivery workflow must keep the raw token out of logs and audit metadata.
export const createAcceptanceCapability = createServerOnlyFn(async () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { token, tokenHash: await hashAcceptanceToken(token) };
});

// A separate server secret lets retries reconstruct one link without storing its raw token.
export const deriveDeliveryCapability = createServerOnlyFn(async (deliveryId: string) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(deliveryId))
    throw new Error("Invalid delivery ID");
  const secret = process.env["QUOTE_LINK_SECRET"] ?? "";
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error("Quote link key is not configured.");
  const bytes = Uint8Array.from(secret.match(/../g) ?? [], (part) => parseInt(part, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`skyrun-quote-acceptance/v1/${deliveryId.toLowerCase()}`),
  );
  const token = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { token, tokenHash: await hashAcceptanceToken(token) };
});
