export const CATALOGUE_PATH = "/catalogue";

export function catalogueUrl(origin: string) {
  const base = new URL(origin);
  if (
    base.protocol !== "https:" &&
    !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))
  )
    throw new Error("Invalid catalogue origin");
  return new URL(CATALOGUE_PATH, base.origin).href;
}
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  const normalized = phone
    .trim()
    .replace(/[\s().-]/g, "")
    .replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized.slice(1) : null;
}
export function whatsappCatalogueLink(origin: string, phone?: string | null) {
  const number = phone === undefined ? "" : whatsappNumber(phone);
  if (number === null) return null;
  const text = `Here is the Skyrun Limo vehicle catalogue: ${catalogueUrl(origin)}\nPlease share your trip details so our team can confirm vehicle suitability and availability.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
