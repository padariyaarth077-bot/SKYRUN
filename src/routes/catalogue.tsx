import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VehicleCatalogue } from "@/components/vehicle-catalogue";

export const Route = createFileRoute("/catalogue")({
  head: () => ({
    meta: [
      { title: "Vehicle Catalogue — Skyrun Limo" },
      {
        name: "description",
        content:
          "View Skyrun Limo vehicle models. Vehicle suitability, capacity and availability are confirmed for each enquiry.",
      },
    ],
  }),
  component: Catalogue,
});
function Catalogue() {
  const [search, setSearch] = useState("");
  return (
    <div className="bg-background text-foreground">
      <SiteHeader />
      <main className="page-width space-y-5 pb-12 pt-28">
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
