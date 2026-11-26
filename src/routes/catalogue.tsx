import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VehicleCatalogue } from "@/components/vehicle-catalogue";
import { publicSeo } from "@/lib/seo";

export const Route = createFileRoute("/catalogue")({
  head: () =>
    publicSeo(
      "/catalogue",
      "Skyrun Limo Vehicle Catalogue | Chicago Chauffeur Service",
      "Browse vehicle models used across Skyrun’s chauffeur categories. Vehicle suitability and availability are confirmed for each journey request.",
    ),

  component: Catalogue,
});
function Catalogue() {
  const [search, setSearch] = useState("");
  return (
    <div className="public-site bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" className="page-width space-y-5 pb-12 pt-28">
        <h1 className="font-display text-4xl">Skyrun vehicle catalogue</h1>
        <label className="block">
          Search vehicle models
          <input
            className="ml-3 rounded border p-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <VehicleCatalogue search={search} />
        <Link
          to="/book"
          className="inline-block rounded bg-primary px-4 py-3 text-primary-foreground"
        >
          Request a ride
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
