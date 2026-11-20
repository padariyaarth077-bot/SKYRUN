import { createFileRoute } from "@tanstack/react-router";
import { PublicFleet } from "@/components/public-fleet";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet \u2014 Skyrun Limo Chicago" },
      {
        name: "description",
        content:
          "Luxury sedan, SUV and executive vehicle categories available on request in Chicago.",
      },
      { property: "og:title", content: "Fleet \u2014 Skyrun Limo Chicago" },
      {
        property: "og:description",
        content:
          "Luxury sedan, SUV and executive vehicle categories available on request in Chicago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FleetPage,
});

function FleetPage() {
  return (
    <div className="public-site">
      <SiteHeader />
      <main id="main-content">
        <div className="page-width fleet-intro">
          <p className="mobility-kicker">THE SKYRUN FLEET</p>
          <h1>Your ride. Your choice.</h1>
          <p>
            Compare regular categories for Chicago and surrounding suburbs, or request a specific
            vehicle from our Special Fleet. Every journey starts with an enquiry.
          </p>
        </div>
        <PublicFleet />
      </main>
      <SiteFooter />
    </div>
  );
}
