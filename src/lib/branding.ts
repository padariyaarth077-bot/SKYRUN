export const OFFICIAL_LOGO = "/branding/skyrun-logo-display.png";
export const HEADER_LOGO = "/branding/skyrun-logo-header.png";
export const SOCIAL_LOGO = "/branding/skyrun-logo-social.jpg";

// Supply a verified, published official asset URL only after separate publication approval.
export function emailBrandingHtml(verifiedLogoUrl?: string) {
  if (!verifiedLogoUrl)
    return '<h1 style="font:700 24px Arial,sans-serif;color:#112139">SKYRUN LIMO</h1>';
  const url = new URL(verifiedLogoUrl);
  if (
    url.protocol !== "https:" ||
    !["skyrunlimo.com", "www.skyrunlimo.com"].includes(url.hostname) ||
    url.pathname !== OFFICIAL_LOGO ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use a verified official Skyrun logo URL");
  return `<img src="${url.href}" alt="Skyrun Limo — Premium Limo Service" width="144" height="144" style="display:block;width:144px;height:144px;max-width:100%;border:0;margin:0 0 20px;background:#020b16" />`;
}
