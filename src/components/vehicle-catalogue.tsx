import { CarFront, Images } from "lucide-react";
import { VEHICLE_MODELS } from "@/lib/vehicle-images";

export function VehicleCatalogue({
  search = "",
  internal = false,
}: {
  search?: string;
  internal?: boolean;
}) {
  const models = VEHICLE_MODELS.filter((model) =>
    model.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {internal
          ? "Models offered by your team, shown using the supplied photos. Vehicle quantities, passenger capacity and luggage capacity have not been recorded. This catalogue does not represent individual cars or confirm availability."
          : "Explore our vehicle models and configurations. Exact vehicle, passenger and luggage capacity, and availability are confirmed by the Skyrun team for each enquiry."}
      </p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((model, index) => (
          <article
            key={model.name}
            className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
          >
            <div
              className={`relative border-b border-border/50 p-4 ${["bg-blue-50/70", "bg-violet-50/70", "bg-emerald-50/70"][index % 3]}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  <CarFront aria-hidden="true" className="size-3.5" /> Model reference
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Images aria-hidden="true" className="size-3.5" /> {model.photos.length}{" "}
                  {model.photos.length === 1 ? "photo" : "photos"}
                </span>
              </div>
              <div className={model.photos.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
                {model.photos.map((image) => (
                  <div
                    key={image.path}
                    className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-white/80 p-2"
                  >
                    <img
                      src={image.path}
                      alt={image.label}
                      loading="lazy"
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 p-5">
              <h2 className="text-base font-semibold tracking-tight">{model.name}</h2>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span>
                  {internal ? "Quantity not recorded" : "Ask our team about availability"}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!models.length && <p>No models match this search.</p>}
    </>
  );
}
