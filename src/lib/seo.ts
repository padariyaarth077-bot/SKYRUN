const SITE_ORIGIN = "https://www.skyrunlimo.com";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/branding/skyrun-logo-social.jpg`;

export function publicSeo(path: string, title: string, description: string) {
  const url = new URL(path, SITE_ORIGIN).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Skyrun Limo official logo" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:image:alt", content: "Skyrun Limo official logo" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Skyrun Limo LLC",
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/branding/skyrun-logo-display.png`,
  email: "skyrunlimo2428@gmail.com",
  areaServed: ["Chicago, Illinois", "Chicago suburbs"],
  contactPoint: [
    { "@type": "ContactPoint", telephone: "+1-224-619-2024", contactType: "customer service" },
    { "@type": "ContactPoint", telephone: "+1-779-240-6371", contactType: "customer service" },
  ],
};
