import { createFileRoute } from "@tanstack/react-router";
import { PublicFleet } from "@/components/public-fleet";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/fleet")({
  head: () =>
    publicSeo(
      "/fleet",
      "Chicago Limo Fleet | Sedans, SUVs & Special Vehicles | Skyrun Limo",
      "Explore Skyrun’s regular sedan and SUV categories and special vehicles for chauffeur service in Chicago. Availability and suitability are confirmed for each request.",
    ),

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
