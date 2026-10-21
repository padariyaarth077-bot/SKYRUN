import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FinanceDocument } from "@/components/finance-documents";
export const Route = createFileRoute("/_authenticated/admin/document/$kind/$id")({
  head: () => ({
    meta: [{ title: "Financial preview — Skyrun Admin" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    bookingId: z.string().uuid().safeParse(s["bookingId"]).success
      ? String(s["bookingId"])
      : undefined,
  }),
  component: Document,
});
function Document() {
  const { kind, id } = Route.useParams(),
    { bookingId } = Route.useSearch();
  if (
    !["invoice", "receipt"].includes(kind) ||
    !(z.string().uuid().safeParse(id).success || (kind === "invoice" && id === "new" && bookingId))
  )
    return <p role="alert">Document route unavailable.</p>;
  return <FinanceDocument kind={kind as "invoice" | "receipt"} id={id} bookingId={bookingId} />;
}
