import { useEffect, useState } from "react";
import { catalogueUrl, whatsappCatalogueLink } from "@/lib/catalogue-sharing";

export function CatalogueShare({ phone }: { phone?: string | null }) {
  const [origin, setOrigin] = useState(""),
    [feedback, setFeedback] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? catalogueUrl(origin) : "";
  const whatsapp = origin ? whatsappCatalogueLink(origin, phone) : null;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!url}
          className="rounded border px-3 py-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setFeedback("Catalogue link copied.");
            } catch {
              setFeedback(
                "Could not copy automatically. Open the public catalogue and copy its address.",
              );
            }
          }}
        >
          Copy catalogue link
        </button>
        {whatsapp ? (
          <a
            className="rounded border px-3 py-2"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WhatsApp
          </a>
        ) : (
          <button disabled className="rounded border px-3 py-2 opacity-50">
            Open WhatsApp
          </button>
        )}
        {url && (
          <a className="px-2 py-2 underline" href={url} target="_blank" rel="noopener noreferrer">
            View public catalogue
          </a>
        )}
      </div>
      {phone !== undefined && !whatsapp && (
        <p>
          Add a phone number with its international country code, starting with +. No country code
          is assumed.
        </p>
      )}
      <p className="text-muted-foreground">
        Opens a prepared WhatsApp draft. Staff reviews and sends it manually; opening WhatsApp does
        not mean a message was sent or delivered.
      </p>
      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
