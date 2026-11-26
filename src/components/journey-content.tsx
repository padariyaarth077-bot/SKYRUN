import { ArrowUpRight, Mail, Phone, MapPin } from "lucide-react";
import { submitLead } from "@/lib/leads.functions";
import { useRef, useState, type FormEvent } from "react";
import chicago from "@/assets/skyrun-chicago.jpg";
import { trackLead } from "@/lib/meta-pixel";

const escalade = "/vehicle-images/cadillac-escalade-esv-preview.jpg";
const sprinter = "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg";

function JourneySteps({ airport = false }: { airport?: boolean }) {
  return (
    <section className="journey-process">
      <div className="page-width">
        <p className="mobility-kicker">FROM YOUR FIRST ENQUIRY</p>
        <h2>A clear route to your ride.</h2>
        <div className="journey-step-grid">
          {[
            [
              "Share your itinerary",
              airport
                ? "Tell us your airport, flight number, travel date, pickup address and destination."
                : "Send your pickup, destination, travel date and any stops or timing requirements.",
            ],
            [
              "Discuss the details",
              "Include passenger and luggage needs. Our team will discuss a suitable vehicle, availability and your quote.",
            ],
            [
              "Confirm your arrangement",
              "Review the agreed details with Skyrun. An enquiry alone does not confirm a reservation.",
            ],
          ].map(([title, body], i) => (
            <article key={title}>
              <span className="step-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactDetails() {
  return (
    <div className="contact-card-grid">
      <a href="tel:+12246192024">
        <Phone aria-hidden="true" />
        <span>
          <strong className="contact-person-name">Vrund Patel</strong>
          <strong>224-619-2024</strong>
        </span>
        <ArrowUpRight aria-hidden="true" />
      </a>
      <a href="tel:+17792406371">
        <Phone aria-hidden="true" />
        <span>
          <strong className="contact-person-name">Nisharg Patel</strong>
          <strong>779-240-6371</strong>
        </span>
        <ArrowUpRight aria-hidden="true" />
      </a>
      <a href="mailto:skyrunlimo2428@gmail.com">
        <Mail aria-hidden="true" />
        <span>
          Email the team<strong>skyrunlimo2428@gmail.com</strong>
        </span>
        <ArrowUpRight aria-hidden="true" />
      </a>
    </div>
  );
}

function ContactEnquiryForm() {
  const submissionKey = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError("");
    setReference("");
    try {
      submissionKey.current ??= crypto.randomUUID();
      const result = await submitLead({
        data: {
          source: "CONTACT_FORM",
          submissionKey: submissionKey.current,
          name: String(values.get("name") ?? ""),
          email: String(values.get("email") ?? ""),
          phone: String(values.get("phone") ?? ""),
          subject: "General contact enquiry",
          message: String(values.get("message") ?? ""),
        },
      });
      setReference(result.reference);
      trackLead(result.reference);
      submissionKey.current = undefined;
      form.reset();
    } catch {
      setError("We couldn’t send your message. Please try again or contact the team directly.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="enquiry-form-panel contact-enquiry-form" onSubmit={handleSubmit}>
      <p className="mobility-kicker">SEND A MESSAGE</p>
      <div className="contact-form-grid">
        <label>
          <span>Full name</span>
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required maxLength={200} />
        </label>
        <label>
          <span>Phone</span>
          <input name="phone" type="tel" autoComplete="tel" required minLength={5} maxLength={40} />
        </label>
        <label className="contact-message-field">
          <span>How can we help?</span>
          <textarea name="message" required maxLength={4000} rows={5} />
        </label>
      </div>
      {error && <p className="contact-form-error" role="alert">{error}</p>}
      {reference && (
        <p className="contact-form-success" role="status">
          Your enquiry was sent to the Skyrun team. Reference: {reference}
        </p>
      )}
      <button className="primary-action" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send enquiry"} <ArrowUpRight aria-hidden="true" />
      </button>
      <p className="contact-form-note">Your message will appear in the admin Contact Messages section.</p>
    </form>
  );
}

export function JourneyContent({
  page,
}: {
  page: "services" | "airport" | "corporate" | "about" | "contact" | "areas";
}) {
  if (page === "contact")
    return (
      <>
        <section className="page-width journey-section">
          <p className="mobility-kicker">A CONVERSATION STARTS HERE</p>
          <h2>Reach the people behind your ride.</h2>
          <ContactDetails />
        </section>
        <section className="journey-enquiry">
          <div className="page-width enquiry-layout">
            <div>
              <p className="mobility-kicker">GENERAL ENQUIRIES</p>
              <h2>How can we help?</h2>
              <p>
                Send a question or ask the team to get in touch. For pickup, destination, date, time,
                and vehicle details, use the separate ride request form.
              </p>
              <p>
                <MapPin aria-hidden="true" size={18} /> Chicago and surrounding suburbs
              </p>
              <p>
                For a ride request, use the Book a Ride button in the header.
              </p>
              <a className="journey-link" href="/book">
                Book a ride <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
            <ContactEnquiryForm />
          </div>
        </section>
      </>
    );
  if (page === "areas")
    return (
      <>
        <section className="page-width journey-section coverage-layout">
          <div>
            <p className="mobility-kicker">OUR LOCAL FOCUS</p>
            <h2>Chicago, connected to your plans.</h2>
            <p>
              From a city pickup to a suburban destination, start with the two addresses that matter
              to you. Skyrun’s current service focus is Chicago and surrounding suburbs.
            </p>
            <p>
              Share your complete route so our team can confirm whether the requested journey can be
              arranged.
            </p>
            <a className="journey-link" href="/book">
              Check your route <ArrowUpRight />
            </a>
          </div>
          <div className="coverage-panel">
            <span>CHICAGO & SURROUNDING SUBURBS</span>
            <h3>
              Your pickup.
              <br />
              Your destination.
            </h3>
            <div className="coverage-route">
              <MapPin />
              <span>City & suburban journeys</span>
            </div>
            <div className="coverage-route">
              <MapPin />
              <span>O’Hare · ORD</span>
            </div>
            <div className="coverage-route">
              <MapPin />
              <span>Midway · MDW</span>
            </div>
            <p>Coverage, vehicle availability and pricing are confirmed for each enquiry.</p>
          </div>
        </section>
        <PhotoStory
          image={chicago}
          alt="Chicago skyline"
          kicker="A ROUTE THAT WORKS FOR YOU"
          title="Every itinerary starts with the details."
          body="Include planned stops, pickup times and any return journey in your request. For a destination outside the current service area, ask the team before making arrangements."
        />
        <JourneySteps />
      </>
    );
  if (page === "about")
    return (
      <>
        <PhotoStory
          image={escalade}
          alt="Skyrun Cadillac Escalade vehicle photograph"
          kicker="SKYRUN LIMO LLC"
          title="A Chicago point of view. A personal conversation."
          body="Skyrun brings together airport transfers, business travel and transportation for special occasions in Chicago and surrounding suburbs. Your request starts with the team: the route, the timing and the kind of vehicle you have in mind."
        />
        <section className="journey-process">
          <div className="page-width">
            <p className="mobility-kicker">THE WAY WE PLAN</p>
            <h2>Consider the whole journey.</h2>
            <div className="journey-step-grid">
              {[
                [
                  "Details first",
                  "Pickup addresses, stops and passenger needs help shape the conversation.",
                ],
                [
                  "The right request",
                  "Compare Regular categories or ask about a specific vehicle in our separate Special Fleet.",
                ],
                [
                  "Clear next steps",
                  "Availability and final pricing are discussed directly before arrangements are confirmed.",
                ],
              ].map(([title, body]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="page-width journey-section">
          <p className="mobility-kicker">MEET YOUR POINTS OF CONTACT</p>
          <h2>Speak with Vrund or Nisharg.</h2>
          <p>Reach the people behind Skyrun directly to discuss your next journey.</p>
          <ContactDetails />
        </section>
      </>
    );
  if (page === "services")
    return (
      <>
        <section className="page-width journey-section">
          <p className="mobility-kicker">MAKE ROOM FOR YOUR PLANS</p>
          <h2>One city. Many reasons to travel.</h2>
          <div className="service-editorial-grid">
            {[
              {
                title: "Airport transfers",
                body: "Plan your journey to or from O’Hare or Midway, with pickup details discussed directly.",
                image: escalade,
                href: "/airport-transfer",
              },
              {
                title: "Corporate transportation",
                body: "Bring your meetings, client pickups and business itinerary into one considered request.",
                image: sprinter,
                href: "/corporate-transportation",
              },
              {
                title: "Special occasions",
                body: "Explore a specific vehicle for your celebration, with a custom quote and availability review.",
                image: "/vehicle-images/rolls-royce-ghost.jpg",
                href: "/special-occasions",
              },
            ].map((item) => (
              <a className="service-editorial-card" href={item.href} key={item.title}>
                <img src={item.image} alt={item.title + " vehicle photograph"} loading="lazy" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <span>
                    Explore service <ArrowUpRight size={18} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
        <section className="page-width service-options">
          <article>
            <h3>Hourly chauffeur</h3>
            <p>
              Share your schedule, stops and requested duration so the team can discuss an
              arrangement for your day.
            </p>
          </article>
          <article>
            <h3>Point-to-point travel</h3>
            <p>Request a one-way or return journey across Chicago and surrounding suburbs.</p>
          </article>
          <article>
            <h3>Events & gatherings</h3>
            <p>
              Tell us the venue, timing and group needs. Vehicle suitability and availability are
              reviewed with you.
            </p>
          </article>
        </section>
        <JourneySteps />
      </>
    );
  const airport = page === "airport";
  return (
    <>
      <PhotoStory
        image={airport ? escalade : sprinter}
        alt={
          airport ? "Skyrun Cadillac Escalade photograph" : "Skyrun executive Sprinter photograph"
        }
        kicker={airport ? "BETWEEN THE AIRPORT AND YOUR NEXT STOP" : "BUILT AROUND YOUR ITINERARY"}
        title={
          airport
            ? "Arrive with a plan for the road ahead."
            : "Keep the day moving, meeting by meeting."
        }
        body={
          airport
            ? "Whether you are heading to a departure or planning your arrival, share the flight and ground-travel details together. Our team will discuss timing, pickup instructions and the vehicle for your request."
            : "From an airport arrival to a client visit or corporate gathering, share the complete schedule with Skyrun. Include the people, locations and timing that need to come together."
        }
      />
      <section className="page-width service-options">
        {(airport
          ? [
              [
                "O’Hare · ORD",
                "Request a transfer between O’Hare International Airport and Chicago or the surrounding suburbs.",
              ],
              [
                "Midway · MDW",
                "Share your arrival or departure details for a transfer to or from Midway International Airport.",
              ],
              [
                "Your luggage & stops",
                "Include luggage requirements and any additional stops so the team can discuss a suitable arrangement.",
              ],
            ]
          : [
              [
                "Executive journeys",
                "Airport transfers, client pickups and travel between meetings, planned around your requested itinerary.",
              ],
              [
                "Corporate events",
                "Share venue addresses, schedules and passenger needs for conferences or company gatherings.",
              ],
              [
                "Recurring travel",
                "Discuss repeat journeys directly with the team. Each arrangement is subject to confirmation.",
              ],
            ]
        ).map(([title, body]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <JourneySteps airport={airport} />
      <section className="page-width journey-section fleet-journey-prompt">
        <div>
          <p className="mobility-kicker">CHOOSE YOUR STARTING POINT</p>
          <h2>A category, or something specific?</h2>
          <p>
            Compare Regular Fleet categories for your trip, or request a named Special Fleet vehicle
            with a custom quote and availability review.
          </p>
        </div>
        <a className="journey-link" href="/fleet">
          Explore the fleet <ArrowUpRight />
        </a>
      </section>
    </>
  );
}

function PhotoStory({
  image,
  alt,
  kicker,
  title,
  body,
}: {
  image: string;
  alt: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section className="page-width journey-section photo-story">
      <figure>
        <img src={image} alt={alt} loading="lazy" />
        <figcaption>
          {image === chicago
            ? "Chicago, Illinois"
            : "Explore the vehicle collection · availability confirmed on enquiry"}
        </figcaption>
      </figure>
      <div>
        <p className="mobility-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{body}</p>
        <a className="journey-link" href="/book">
          Discuss your journey <ArrowUpRight />
        </a>
      </div>
    </section>
  );
}
