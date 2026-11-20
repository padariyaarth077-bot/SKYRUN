import { ArrowUpRight } from "lucide-react";
import { REGULAR_FLEET, SPECIAL_FLEET } from "@/lib/public-fleet";

export function PublicFleet({
  search = "",
  preview = false,
}: {
  search?: string;
  preview?: boolean;
}) {
  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  const regular = REGULAR_FLEET.filter((entry) => matches(entry.name));
  const special = SPECIAL_FLEET.filter((entry) => matches(entry.name)).slice(
    0,
    preview ? 2 : undefined,
  );
  if (!regular.length && !special.length) return <p>No vehicles match this search.</p>;
  return (
    <div id="fleet">
      <section className="regular-fleet" aria-labelledby="regular-fleet-heading">
        <div className="page-width mobility-section">
          <div className="section-title">
            <div>
              <p className="mobility-kicker">CHICAGO AND SURROUNDING SUBURBS</p>
              <h2 id="regular-fleet-heading">Regular Fleet</h2>
              <p>
                Choose a sedan or SUV category. Airport rates apply to O’Hare and Midway transfers
                up to 30 miles; other trip arrangements are confirmed by the team.
              </p>
            </div>
            <span className="fleet-disclaimer">
              Exact vehicle and capacity confirmed on enquiry.
            </span>
          </div>
          <div className="vehicle-grid regular-category-grid">
            {regular.map((entry) => {
              return (
                <article className="vehicle-card" key={entry.name}>
                  <div className="vehicle-photos">
                    <img
                      src={
                        entry.name === "Regular SUV"
                          ? "/vehicle-images/chevrolet-suburban.jpg"
                          : entry.name === "Luxury SUV"
                            ? "/vehicle-images/cadillac-escalade-esv-2.jpg"
                            : entry.image
                      }
                      alt={entry.name}
                      loading="lazy"
                      width="640"
                      height="480"
                    />
                  </div>
                  <div className="vehicle-body">
                    <h3>{entry.name}</h3>
                    <p>{entry.description}</p>
                    <div className="fleet-rate">
                      <strong>
                        {entry.name.includes("SUV") ? "SUV · $150" : "Sedan · $120"}
                        <span> / airport transfer</span>
                      </strong>
                      <small>
                        Airport transfer up to 30 miles · O’Hare or Midway. Request your category;
                        the team confirms arrangements.
                      </small>
                    </div>
                    <a
                      href={`/book?vehicle=${encodeURIComponent(entry.name)}`}
                      className="vehicle-request"
                    >
                      Request a Ride <ArrowUpRight size={18} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          {!regular.length && <p>No matching regular categories.</p>}
          {!preview && !search.trim() && (
            <div className="reference-pricing">
              <h3>Approved airport transfer rates</h3>
              <p>
                O’Hare and Midway transfers up to 30 miles. Share your trip details and the Skyrun
                team will confirm arrangements.
              </p>
              <div
                className="rate-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Approved airport transfer pricing"
                data-label="Swipe horizontally to compare all pricing columns"
              >
                <table>
                  <caption>Airport transfer rates in USD · O’Hare and Midway</caption>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Transfer up to 30 miles</th>
                      <th scope="col">Meet & greet</th>
                      <th scope="col">Waiting after 15 min</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Sedan</th>
                      <td>$120 / ride</td>
                      <td>$15</td>
                      <td>$0.75 / min</td>
                    </tr>
                    <tr>
                      <th scope="row">SUV</th>
                      <td>$150 / ride</td>
                      <td>$25</td>
                      <td>$1.00 / min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                First 15 minutes waiting are included. Waiting charges apply only to minutes beyond
                that allowance. Meet & greet is optional. Airport pricing is separate from other
                service rates.
              </p>
            </div>
          )}
          {!preview && !search.trim() && (
            <div className="reference-pricing hourly-pricing">
              <h3>Hourly chauffeur service</h3>
              <p>Vehicle and availability are confirmed by the Skyrun team for your itinerary.</p>
              <div className="hourly-rate-grid">
                <div>
                  <strong>Regular Sedan</strong>
                  <span>$120 / hour</span>
                </div>
                <div>
                  <strong>Black SUV, including Cadillac Escalade</strong>
                  <span>$145 / hour</span>
                </div>
                <div>
                  <strong>11-passenger Shuttle Van</strong>
                  <span>$105 / hour</span>
                </div>
                <div>
                  <strong>14-passenger Executive Bus</strong>
                  <span>$115 / hour</span>
                </div>
                <div>
                  <strong>16-passenger Party Bus</strong>
                  <span>$145 / hour</span>
                </div>
              </div>
              <h3 className="package-heading">Four-hour vehicle packages</h3>
              <div className="hourly-rate-grid">
                <div>
                  <strong>9-passenger Stretch Limousine</strong>
                  <span>$550 / 4 hours</span>
                </div>
                <div>
                  <strong>12-passenger Limo Sprinter</strong>
                  <span>$750 / 4 hours</span>
                </div>
                <div>
                  <strong>14-passenger Party Bus</strong>
                  <span>$850 / 4 hours</span>
                </div>
                <div>
                  <strong>24–28-passenger Party Bus</strong>
                  <span>$1,500 / 4 hours</span>
                </div>
              </div>
            </div>
          )}
          {preview && (
            <a href="/fleet" className="fleet-explore">
              See approved airport rates <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      </section>
      <section className="special-fleet" aria-labelledby="special-fleet-heading">
        <div className="page-width mobility-section">
          <div className="section-title">
            <div>
              <p className="mobility-kicker">A SPECIFIC VEHICLE. A PERSONAL ARRANGEMENT.</p>
              <h2 id="special-fleet-heading">Special Fleet</h2>
              <p>
                A more individual arrival. Explore our vehicle collection, with custom quotes and
                availability confirmed personally.
              </p>
            </div>
            <span className="fleet-disclaimer">
              Availability and capacity confirmed by our team.
              <br />
              Your reservation is confirmed personally.
            </span>
          </div>
          <div
            className="vehicle-grid special-vehicle-grid"
            tabIndex={0}
            role="region"
            aria-label="Special vehicles; scroll to explore"
          >
            {special.map((model) => (
              <article className="vehicle-card" key={model.name}>
                <div
                  className="vehicle-photos"
                  tabIndex={model.photos.length > 1 ? 0 : undefined}
                  aria-label={
                    model.photos.length > 1
                      ? `${model.name} photos; scroll for more views`
                      : undefined
                  }
                >
                  {model.photos.map((photo) => (
                    <img
                      src={
                        photo.path.endsWith("cadillac-escalade-esv-1.jpg")
                          ? "/vehicle-images/cadillac-escalade-esv-preview.jpg"
                          : photo.path
                      }
                      key={photo.path}
                      alt={photo.label}
                      loading="lazy"
                      width="640"
                      height="480"
                    />
                  ))}
                </div>
                <div className="vehicle-body">
                  <span className="approval-badge">Custom quote · By request</span>
                  <h3>{model.name}</h3>
                  <p>
                    Request this vehicle for your occasion. Our team will confirm the details and
                    availability.
                  </p>
                  <a
                    href={`/book?vehicle=${encodeURIComponent(model.name)}`}
                    className="vehicle-request"
                  >
                    Request Availability <ArrowUpRight size={18} aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>
          {!special.length && <p>No matching special vehicles.</p>}
          {preview && (
            <a href="/fleet#special-fleet-heading" className="fleet-explore">
              Explore the Special Fleet <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
