import { EnquiryConfirmation } from "@/components/enquiry-confirmation";
import { HeroCarousel } from "@/components/hero-carousel";
import { ChatWidget } from "@/components/chat-widget";
import { submitRideEnquiry } from "@/lib/leads.functions";
import { submitRegularRide } from "@/lib/regular-booking.functions";
import { regularCode, regularRideSchema } from "@/lib/regular-booking.shared";
import { rideEnquirySchema } from "@/lib/ride-enquiry.shared";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Plane, BriefcaseBusiness, MapPin, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PublicFleet } from "@/components/public-fleet";
import chicagoImage from "@/assets/skyrun-chicago.jpg";
export { Brand };
import { VEHICLE_MODELS } from "@/lib/vehicle-images";
import { REGULAR_FLEET } from "@/lib/public-fleet";
import { trackLead } from "@/lib/meta-pixel";
export const faqs = [
  {
    question: "How do I request a Skyrun ride?",
    answer:
      "Share your trip details through our enquiry form or call the team directly. Your booking is confirmed after Skyrun agrees the arrangements with you.",
  },
  {
    question: "Do you provide airport transportation?",
    answer:
      "Skyrun accepts private chauffeur transfer requests to or from O’Hare (ORD) and Midway (MDW) in Chicago and nearby suburbs. Share your flight, pickup and luggage details so the team can confirm arrangements.",
  },
  {
    question: "Can I request hourly or corporate transportation?",
    answer:
      "Yes. Share your itinerary, stops and timing so the team can discuss a suitable arrangement for your day.",
  },
  {
    question: "Which vehicles are available?",
    answer:
      "Vehicle availability and suitability depend on the date and journey. Please describe your party and luggage needs when requesting a ride.",
  },
  {
    question: "What areas do you serve?",
    answer:
      "Plan your travel across Chicago and surrounding suburbs. Share your pickup and destination so our team can confirm your route.",
  },
  {
    question: "Is my booking confirmed when I submit the form?",
    answer:
      "No. The form sends an enquiry to Skyrun. The team must confirm availability and details with you directly.",
  },
];

export function BookingForm({
  compact = false,
  initialVehicle = "",
}: {
  compact?: boolean;
  initialVehicle?: string;
}) {
  const [status, setStatus] = useState("");
  const [reference, setReference] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState(initialVehicle);
  const [submitting, setSubmitting] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setReference("");
    const values = new FormData(form);
    if (inFlight.current) return;
    const key = submissionKey.current ?? crypto.randomUUID();
    submissionKey.current = key;
    const payload = {
      data: {
        submissionKey: key,
        name: String(values.get("name") ?? ""),
        email: String(values.get("email") ?? ""),
        phone: String(values.get("phone") ?? ""),
        service: String(values.get("service") ?? ""),
        pickupLocation: String(values.get("pickup") ?? ""),
        dropoffLocation: String(values.get("dropoff") ?? ""),
        travelDate: String(values.get("date") ?? ""),
        pickupTime: String(values.get("time") ?? ""),
        passengerCount: String(values.get("passengers") ?? ""),
        vehiclePreference: String(values.get("vehicle") ?? ""),
        notes: String(values.get("notes") ?? ""),
        website: String(values.get("website") ?? ""),
      },
    };
    const parsed = rideEnquirySchema.safeParse(payload.data);
    if (!parsed.success) {
      setStatus(
        `Please check ${parsed.error.issues[0]?.path.join(" ")}: ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setStatus("Sending…");
    const categoryCode = regularCode(String(values.get("vehicle") ?? ""));
    let request: Promise<{ ok: boolean; reference: string }>;
    if (categoryCode) {
      const { vehiclePreference: _preference, ...trip } = parsed.data;
      const regular = regularRideSchema.safeParse({
        ...trip,
        categoryCode,
        luggageDetails: String(values.get("luggage") ?? ""),
      });
      if (!regular.success) {
        inFlight.current = false;
        setSubmitting(false);
        setStatus("Please describe your luggage needs, including no luggage if applicable.");
        return;
      }
      request = submitRegularRide({ data: regular.data });
    } else {
      request = submitRideEnquiry({ data: parsed.data });
    }
    request
      .then((r) => {
        if (!r.ok || !r.reference) throw new Error("Missing confirmation");
        setStatus("");
        setReference(r.reference);
        trackLead(r.reference);
        submissionKey.current = null;
        form.reset();
        setSelectedVehicle(initialVehicle);
      })
      .catch(() =>
        setStatus("Something went wrong. Please check your details or call us directly."),
      )
      .finally(() => {
        inFlight.current = false;
        setSubmitting(false);
      });
  }

  return (
    <form
      className={`booking-form${compact ? " booking-form-compact" : ""}`}
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="form-grid">
        <label className="form-span-two">
          <span>Pickup location</span>
          <input name="pickup" placeholder="Address, airport, or landmark" required />
        </label>
        <label className="form-span-two">
          <span>Drop-off location</span>
          <input name="dropoff" placeholder="Address, airport, or landmark" required />
        </label>
        <label>
          <span>Date</span>
          <input name="date" type="date" required />
        </label>
        <label>
          <span>Pickup time</span>
          <input name="time" type="time" required />
        </label>

        <label>
          <span>Full name</span>
          <input name="name" autoComplete="name" placeholder="Your name" required />
        </label>
        <label>
          <span>Phone</span>
          <input
            name="phone"
            autoComplete="tel"
            type="tel"
            placeholder="Best number to reach you"
            required
          />
        </label>
        <label>
          <span>Email</span>
          <input
            name="email"
            autoComplete="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          <span>Service</span>
          <select name="service" defaultValue="" required>
            <option value="" disabled>
              Select a service
            </option>
            <option>Airport transfer</option>
            <option>Corporate transportation</option>
            <option>Hourly chauffeur</option>
            <option>Point-to-point</option>
            <option>Special occasion</option>
            <option>Event transportation</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          <span>Passengers</span>
          <input
            name="passengers"
            type="number"
            min="1"
            max="99"
            placeholder="Number of passengers"
            required
          />
        </label>
        <label>
          <span>Vehicle preference</span>
          <select
            name="vehicle"
            defaultValue={initialVehicle}
            onChange={(event) => setSelectedVehicle(event.target.value)}
          >
            <option value="">No preference</option>
            <optgroup label="Regular Fleet — category request">
              {REGULAR_FLEET.map((entry) => (
                <option key={entry.name}>{entry.name}</option>
              ))}
            </optgroup>
            <optgroup label="Special Fleet — availability and approval required">
              {VEHICLE_MODELS.map((model) => (
                <option key={model.name}>{model.name}</option>
              ))}
            </optgroup>
          </select>
        </label>
        {regularCode(selectedVehicle) && (
          <label className="form-span-two">
            <span>Luggage details</span>
            <input
              name="luggage"
              required
              maxLength={500}
              placeholder="Describe bags, or enter no luggage"
            />
            <small>
              Regular ride request · awaiting admin review. Final amount and category availability
              require approval. Payment is not requested during booking. Times are Chicago local
              time.
            </small>
          </label>
        )}
        <label className="form-span-two">
          <span>Additional notes</span>
          <textarea name="notes" rows={3} placeholder="Luggage, stops, or other details" />
        </label>
      </div>
      <div className="form-submit-row">
        <Button className="button-gold" type="submit" disabled={submitting}>
          {submitting ? "Sending request…" : "Send ride request"} <ArrowRight aria-hidden="true" />
        </Button>
        {status && !submitting && (
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.form?.reset();
              submissionKey.current = null;
              setSelectedVehicle(initialVehicle);
              setStatus("");
              setReference("");
            }}
          >
            Start a new enquiry
          </button>
        )}
        <p>
          Sent securely to the Skyrun team. Availability and ride details are confirmed directly.
        </p>
      </div>
      {reference && <EnquiryConfirmation reference={reference} />}
      {status && (
        <p className="form-status" role="status">
          {status}
        </p>
      )}
    </form>
  );
}

export function HomePage() {
  const services = [
    {
      title: "Airport transfers",
      copy: "Your next arrival, thoughtfully arranged. O’Hare, Midway and your onward journey.",
      to: "/airport-transfer",
      Icon: Plane,
      image: "/vehicle-images/cadillac-escalade-esv-2.jpg",
    },
    {
      title: "Corporate travel",
      copy: "From the first meeting to the last stop. Share your itinerary with our team.",
      to: "/corporate-transportation",
      Icon: BriefcaseBusiness,
      image: "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg",
    },
    {
      title: "Hourly & city rides",
      copy: "One destination or a day of possibilities. Plan a journey around your schedule.",
      to: "/book",
      Icon: Clock3,
      image: "/vehicle-images/chevrolet-suburban.jpg",
    },
    {
      title: "Special occasions",
      copy: "Make the arrival part of the occasion. Explore a vehicle for your celebration.",
      to: "/occasions",
      Icon: MapPin,
      image: "/vehicle-images/rolls-royce-ghost.jpg",
    },
  ];
  return (
    <div className="public-site public-home">
      <SiteHeader overlay />
      <main id="main-content">
        <section className="mobility-hero">
          <HeroCarousel />
          <div className="journey-shade" />
          <div className="page-width mobility-hero-grid">
            <div className="journey-intro">
              <p className="hero-eyebrow">
                <span /> PRIVATE CHAUFFEUR SERVICE · CHICAGO
              </p>
              <h1>
                Exceptional
                <br />
                <em>Journeys.</em>
                <br />
                Distinguished Arrivals.
              </h1>
              <span className="editorial-rule" />
              <p className="hero-summary">
                Premium chauffeur transportation for airport arrivals, business travel and special
                occasions across Chicago and surrounding suburbs.
              </p>
              <div className="hero-promises">
                <span>
                  <Plane size={16} /> Airport transfers
                </span>
                <span>
                  <BriefcaseBusiness size={16} /> Business travel
                </span>
                <span>
                  <MapPin size={16} /> Chicago & suburbs
                </span>
              </div>
            </div>
            <div className="journey-panel">
              <p className="mobility-kicker">EVERY JOURNEY STARTS SOMEWHERE</p>
              <h2>
                Where will you
                <br />
                go next?
              </h2>
              <div className="journey-options">
                {services.map(({ title, to, Icon }) => (
                  <Link to={to} key={title}>
                    <span className="journey-option-icon">
                      <Icon size={20} />
                    </span>
                    <span>{title}</span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <Link className="primary-action" to="/book">
                Request your ride <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p className="journey-panel-note">
                A personal enquiry. Details confirmed by our team.
              </p>
            </div>
          </div>
          <div className="page-width hero-bottom">
            <span>YOUR CITY. YOUR OCCASION. YOUR SKYRUN.</span>
            <a href="#services">
              Explore the experience <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section className="page-width mobility-section experience-section" id="services">
          <div className="centered-title">
            <p className="mobility-kicker">THOUGHTFUL TRAVEL, FROM THE START</p>
            <h2>
              A little more care.
              <br />A different kind of journey.
            </h2>
            <span className="editorial-rule" />
            <p>
              Private transportation for the plans that matter, across Chicago and surrounding
              suburbs.
            </p>
          </div>
          <div className="mobility-services">
            {services.map(({ title, copy, to, Icon, image }) => (
              <Link to={to} key={title} className="experience-card">
                <div className="experience-photo">
                  <img src={image} alt="" loading="lazy" width="640" height="480" />
                  <span>
                    <Icon size={21} />
                  </span>
                </div>
                <div className="experience-card-body">
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <span className="service-card-link">
                    Explore service <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="personal-service">
          <div className="page-width personal-service-inner">
            <div>
              <p className="mobility-kicker">THE SKYRUN APPROACH</p>
              <h2>
                Personal service.
                <br />
                From people you can reach.
              </h2>
            </div>
            <div>
              <p>
                Tell us where you’re headed and what matters for your trip. Speak directly with the
                Skyrun team about your route, vehicle preference and arrangements.
              </p>
              <a href="tel:+12246192024" className="plain-link">
                Talk to Vrund · 224-619-2024 <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <PublicFleet preview />
        <section className="page-width mobility-section destination-grid">
          <figure className="editorial-photo">
            <div className="editorial-photo-frame">
              <img
                src="/vehicle-images/cadillac-escalade-esv-2.jpg"
                alt="Cadillac Escalade ESV exterior"
                loading="lazy"
                width="515"
                height="388"
              />
            </div>
            <figcaption>FOR THE ARRIVAL. AND EVERYTHING AFTER.</figcaption>
          </figure>
          <div>
            <p className="mobility-kicker">AIRPORT & BUSINESS TRAVEL</p>
            <h2>
              From touchdown
              <br />
              to what’s next.
            </h2>
            <span className="editorial-rule" />
            <p>
              Plan an O’Hare or Midway transfer, a client pickup or a day of meetings. Share your
              flight details, itinerary and luggage needs. We’ll confirm the arrangements with you.
            </p>
            <div className="airport-tags">
              <span>O’Hare · ORD</span>
              <span>Midway · MDW</span>
              <span>Chicago & suburbs</span>
            </div>
            <Link className="primary-action" to="/airport-transfer">
              Plan an airport ride <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="about-journey">
          <img src={chicagoImage} alt="" loading="lazy" />
          <div className="page-width">
            <p className="mobility-kicker">CHICAGO. OUR POINT OF DEPARTURE.</p>
            <h2>
              Meet the people
              <br />
              behind your journey.
            </h2>
            <p>
              <strong>Skyrun Limo LLC</strong> is led by <strong>Vrund Patel</strong> and{" "}
              <strong>Nisharg Patel</strong>. From everyday plans to special occasions, start a
              conversation with the people arranging your ride.
            </p>
            <Link className="secondary-action" to="/about">
              Get to know Skyrun <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <section className="page-width mobility-section home-faq">
          <div>
            <p className="mobility-kicker">BEFORE YOU GO</p>
            <h2>
              A few things
              <br />
              worth knowing.
            </h2>
            <Link to="/faq" className="plain-link">
              All questions <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="faq-list">
            {faqs.slice(0, 4).map((faq) => (
              <details name="skyrun-faq" key={faq.question}>
                <summary>
                  {faq.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="request-section" id="ride-request">
          <div className="page-width mobility-section request-layout">
            <div>
              <p className="mobility-kicker">LET’S PLAN SOMETHING</p>
              <h2>
                Tell us where.
                <br />
                We’ll take it
                <br />
                from here.
              </h2>
              <span className="editorial-rule" />
              <p>
                Your route, your timing, your preferences. Send an enquiry and our team will be in
                touch to confirm your quote and arrangements.
              </p>
              <a className="plain-link" href="tel:+12246192024">
                Prefer a conversation? Call us <ArrowUpRight size={17} />
              </a>
              <div className="enquiry-steps">
                <span>01 · Share your plans</span>
                <span>02 · Receive your quote</span>
                <span>03 · Confirm with our team</span>
              </div>
            </div>
            <div className="request-card">
              <p className="mobility-kicker">YOUR NEXT JOURNEY</p>
              <h3>Request a ride</h3>
              <BookingForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <ChatWidget />
    </div>
  );
}
