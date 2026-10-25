import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";

const messageSchema = z.object({
  deliveryId: z.string().uuid(),
  to: z
    .string()
    .email()
    .max(254)
    .refine((value) => !/[\r\n]/.test(value)),
  quoteId: z.string().uuid(),
  text: z.string().min(1).max(20000),
  isTest: z.boolean(),
});

// Internal transport only: an authorized, durable delivery workflow must supply
// immutable quote data and the same deliveryId/body on retries. No public endpoint.
export const submitQuoteEmail = createServerOnlyFn(async (input: z.input<typeof messageSchema>) => {
  let stage = "input",
    status: number | undefined;
  try {
    const data = messageSchema.parse(input);
    stage = "configuration";
    const key = process.env["RESEND_API_KEY"];
    if (!key) throw new Error("Quote email is not configured.");
    stage = "request";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `quote-delivery/${data.deliveryId}`,
      },
      body: JSON.stringify({
        from: "Skyrun Limo <support@skyrunlimo.com>",
        reply_to: "support@skyrunlimo.com",
        to: [data.to],
        subject: `${data.isTest ? "[TEST ONLY] " : ""}Your Skyrun Limo quote — ${data.quoteId}`,
        text: data.text,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    status =
      Number.isInteger(response.status) && response.status >= 100 && response.status <= 599
        ? response.status
        : undefined;
    stage = "provider_response";
    if (!response.ok) throw new Error("Provider rejected the request");
    stage = "response_format";
    const body: unknown = await response.json();
    const result = z.object({ id: z.string().uuid() }).parse(body);
    // Provider acceptance is not evidence of delivery to the customer's inbox.
    return { providerEmailId: result.id, state: "provider_accepted" as const };
  } catch (error) {
    // Log only fixed stages/status, never exceptions, provider bodies or message data.
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    console.info(JSON.stringify({ event: "quote_email_failure", stage, status, timeout }));
    // A timeout may occur after acceptance: reconcile/retry the same delivery,
    // never generate a new delivery ID or mark the quote sent from this error.
    if (stage === "configuration") throw new Error("Quote email is not configured.");
    throw new Error(
      "Quote email submission could not be confirmed. Check delivery before retrying.",
    );
  }
});
