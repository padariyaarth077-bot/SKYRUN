import { ChatWidget } from "@/components/chat-widget";
import { submitRideEnquiry } from "@/lib/leads.functions";
import { rideEnquirySchema } from "@/lib/ride-enquiry.shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/skyrun-hero.jpg";
import airportImage from "@/assets/skyrun-airport.jpg";
import chicagoImage from "@/assets/skyrun-chicago.jpg";
import executiveImage from "@/assets/skyrun-executive.jpg";
import suvImage from "@/assets/skyrun-suv.jpg";
import limoImage from "@/assets/skyrun-limo.jpg";
import vanImage from "@/assets/skyrun-van.jpg";
import interiorImage from "@/assets/skyrun-interior.jpg";

const slides = [
  { image: heroImage, label: "Chicago, after hours" },
  { image: suvImage, label: "A hotel arrival downtown" },
  { image: airportImage, label: "A considered airport arrival" },
  { image: interiorImage, label: "The city from the back seat" },
  { image: chicagoImage, label: "The Chicago skyline" },
];

const services = [
  {
    number: "01",
    title: "Airport transfers",
    description: "To and from O'Hare, Midway and all airports.",
    image: airportImage,
    imageAlt: "Executive sedan outside an airport terminal",
    anchor: "airport",
  },
  {
    number: "02",
    title: "Private chauffeur",
    description: "Your own chauffeur, shaped around your day.",
    image: suvImage,
    imageAlt: "Chauffeur opening an SUV door at a Chicago hotel",
    anchor: "book",
  },
  {
    number: "03",
    title: "Corporate transportation",
    description: "Corporate travel made easy.",
    image: executiveImage,
    imageAlt: "Chauffeur preparing a vehicle downtown",
    anchor: "corporate",
  },
  {
    number: "04",
    title: "Hourly service",
    description: "As you need, for as long as you need.",
    image: interiorImage,
    imageAlt: "Luxury rear cabin with Chicago skyline view",
    anchor: "book",
  },
  {
    number: "05",
    title: "Point-to-point",
    description: "One way or round trip.",
    image: heroImage,
    imageAlt: "Black vehicle on a downtown Chicago street",
    anchor: "book",
  },
  {
    number: "06",
    title: "Special occasions",
    description: "Weddings, celebrations and evenings out.",
    image: limoImage,
    imageAlt: "Limousine outside an elegant venue",
    anchor: "occasions",
  },
  {
    number: "07",
    title: "Group transportation",
    description: "Room for teams, families and events.",
    image: vanImage,
    imageAlt: "Black executive van in Chicago",
    anchor: "book",
  },
  {
    number: "08",
    title: "Long-distance",
    description: "Chicago to all destinations.",
    image: chicagoImage,
    imageAlt: "Chicago skyline at golden hour",
    anchor: "chicago",
  },
];

const fleet = [
  {
    name: "Luxury SUV",
    category: "SUV",
    description: "Room for luggage and small groups.",
    image: suvImage,
    alt: "Black luxury SUV at a Chicago hotel entrance",
  },
  {
    name: "Luxury sedan",
    category: "SEDAN",
    description: "A composed choice for airport and city travel.",
    image: airportImage,
    alt: "Black sedan at an airport terminal",
  },
  {
    name: "Executive transportation",
    category: "EXECUTIVE",
    description: "For meetings, clients and business days.",
    image: executiveImage,
    alt: "Chauffeur beside an executive vehicle",
  },
  {
    name: "Premium limousine",
    category: "LIMOUSINE",
    description: "For occasions that call for more.",
    image: limoImage,
    alt: "Black stretch limousine at night",
  },
  {
    name: "Executive van",
    category: "GROUP",
    description: "For teams and larger parties.",
    image: vanImage,
    alt: "Black executive van in downtown Chicago",
  },
];

export const faqs = [
  {
    question: "How do I request a Skyrun ride?",
    answer:
      "Send a request through the form below or call one of the contacts on the business card. Your ride is not confirmed until Skyrun responds directly.",
  },
  {
    question: "Do you provide airport transportation?",
    answer:
      "Airport transportation is part of Skyrun's service offering. Include your airport, flight schedule, pickup details, and luggage needs in your request.",
  },
  {
    question: "Can I request hourly or corporate transportation?",
    answer:
      "The business card references hourly and corporate travel. Share your itinerary and timing so the team can confirm the right arrangement.",
  },
  {
    question: "Which vehicles are available?",
    answer:
      "Vehicle availability and suitability depend on the date and journey. Please describe your party and luggage needs when requesting a ride.",
  },
  {
    question: "What areas do you serve?",
    answer:
      "Skyrun is based in Chicago, Illinois, and the business card references Chicago-to-airport and destination travel. Contact the team to confirm your specific pickup and destination.",
  },
  {
    question: "Is my booking confirmed when I submit the form?",
    answer:
      "No. The form prepares a request email for Skyrun. The team must confirm availability and details with you directly.",
  },
];

const contacts = [
  { name: "Vrund Patel", phone: "224-619-2024", href: "+12246192024" },
  { name: "Nisharg Patel", phone: "779-240-6371", href: "+17792406371" },
];

import { Brand, SiteHeader, SiteFooter } from "@/components/site-chrome";
export { Brand };

export function BookingForm({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
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
    submitRideEnquiry({ data: parsed.data })
      .then((r) => {
        if (!r.ok || !r.reference) throw new Error("Missing confirmation");
        setStatus(
          `Request received (ref ${r.reference}). Your enquiry is awaiting review; your ride is not yet confirmed.`,
        );
        submissionKey.current = null;
        form.reset();
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
          <select name="vehicle" defaultValue="">
            <option value="">No preference</option>
            <option>Luxury sedan</option>
            <option>Luxury SUV</option>
            <option>Executive van</option>
            <option>Premium limousine</option>
          </select>
        </label>
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
              setStatus("");
            }}
          >
            Start a new enquiry
          </button>
        )}
        <p>
          Sent securely to the Skyrun team. Availability and ride details are confirmed directly.
        </p>
      </div>
      {status && (
        <p className="form-status" role="status">
          {status}
        </p>
      )}
    </form>
  );
}

export function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const fleetTrack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, []);

  function moveFleet(direction: -1 | 1) {
    fleetTrack.current?.scrollBy({ left: direction * 440, behavior: "smooth" });
  }

  return (
    <main>
      <SiteHeader overlay />

      <section className="hero" id="home" aria-label="Skyrun Limo Chicago">
        <div className="hero-slides" aria-hidden="true">
          {slides.map((slide, index) => (
            <img
              className={`hero-slide${activeSlide === index ? " hero-slide-active" : ""}`}
              src={slide.image}
              alt=""
              key={slide.label}
              width={index === 0 ? 1920 : index === 3 ? 1808 : 1600}
              height={index === 0 ? 1200 : index === 3 ? 1008 : 1104}
              fetchPriority={index === 0 ? "high" : "auto"}
            />
          ))}
        </div>
        <div className="hero-shade" />
        <div className="hero-copy page-width">
          <p className="eyebrow eyebrow-gold">Private chauffeur service · Chicago, Illinois</p>
          <h1>
            Elevate
            <br />
            every journey.
          </h1>
          <p className="hero-description">
            Premium chauffeur-driven transportation across Chicago.
          </p>
          <div className="hero-actions">
            <Button asChild className="button-gold button-large">
              <a href="#book">
                Book your ride <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
            <a className="text-link text-link-light" href="#fleet">
              Explore our fleet <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="hero-bottom page-width">
          <a className="scroll-cue" href="#intro">
            <span className="scroll-cue-icon">
              <ArrowDown aria-hidden="true" />
            </span>{" "}
            Scroll to explore
          </a>
          <div className="slide-control" aria-label="Hero image selector">
            <span className="slide-count">
              0{activeSlide + 1} <i /> 0{slides.length}
            </span>
            <div className="slide-dots">
              {slides.map((slide, index) => (
                <button
                  key={slide.label}
                  type="button"
                  aria-label={`Show image: ${slide.label}`}
                  aria-pressed={activeSlide === index}
                  className={activeSlide === index ? "slide-dot slide-dot-active" : "slide-dot"}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
          <p className="hero-location">
            <MapPin aria-hidden="true" /> Chicago, Illinois
          </p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Skyrun service highlights">
        <div className="trust-inner page-width">
          <span>
            <ShieldCheck aria-hidden="true" /> Professional chauffeurs
          </span>
          <span>
            <Sparkles aria-hidden="true" /> Premium vehicles
          </span>
          <span>
            <Clock3 aria-hidden="true" /> Personalized service
          </span>
          <span>
            <Plane aria-hidden="true" /> Airport & corporate travel
          </span>
          <span>
            <MapPin aria-hidden="true" /> Chicago transportation
          </span>
        </div>
      </section>

      <section className="intro-section section-light" id="intro">
        <div className="intro-layout page-width">
          <div className="intro-photo-wrap">
            <img
              src={executiveImage}
              alt="Chauffeur preparing a black sedan outside a Chicago hotel"
              width={1600}
              height={1104}
              loading="lazy"
            />
            <span className="image-caption">A more considered way to move through the city</span>
            <span className="photo-index">SKYRUN · CHICAGO</span>
          </div>
          <div className="intro-copy">
            <p className="eyebrow">A better way to arrive</p>
            <h2>
              More than a ride.
              <br />
              <em>A better way to arrive.</em>
            </h2>
            <span className="gold-rule" />
            <p>
              Skyrun Limo provides private chauffeur-driven transportation shaped around comfort,
              professionalism, and the details of your journey.
            </p>
            <p className="intro-small">
              From a ride across town to a carefully timed airport transfer, start with a request
              and let us know what matters along the way.
            </p>
            <a className="text-link" href="#about">
              Discover Skyrun <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className="intro-stamp" aria-hidden="true">
            <span>EST.</span>
            <strong>CHI</strong>
            <span>ILLINOIS</span>
          </div>
        </div>
      </section>

      <section className="services-section section-dark" id="services">
        <div className="page-width">
          <div className="section-heading section-heading-light">
            <div>
              <p className="eyebrow eyebrow-gold">The journey, your way</p>
              <h2>
                Transportation,
                <br />
                <em>designed around you.</em>
              </h2>
            </div>
            <p>
              From airport transfers to the next important meeting, make the ride part of the plan.
            </p>
          </div>
          <div className="service-mosaic">
            {services.map((service, index) => (
              <a
                className={`service-tile service-tile-${index + 1}`}
                href={`#${service.anchor}`}
                key={service.number}
              >
                <img
                  src={service.image}
                  alt={service.imageAlt}
                  width={1600}
                  height={1008}
                  loading="lazy"
                />
                <span className="service-overlay" />
                <span className="service-tile-copy">
                  <span className="service-kicker">{service.number}</span>
                  <strong>{service.title}</strong>
                  <span className="service-description">{service.description}</span>
                </span>
                <span className="service-arrow">
                  <ArrowUpRight aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
          <div className="service-more-row">
            <p>One way · Round trip · Hourly · As you need</p>
            <a className="text-link text-link-light" href="#book">
              Tell us about your journey <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="airport-section section-light" id="airport">
        <div className="airport-layout page-width">
          <div className="airport-copy">
            <p className="eyebrow">
              <Plane aria-hidden="true" /> Arrive with ease
            </p>
            <h2>
              From the terminal
              <br />
              <em>to your destination.</em>
            </h2>
            <span className="gold-rule" />
            <p>
              Set up your airport ride in advance. Share your arrival or departure details, pickup
              location, and luggage needs so Skyrun can coordinate the journey with you.
            </p>
            <ul className="airport-points">
              <li>
                <Check aria-hidden="true" /> Pickup and drop-off requests
              </li>
              <li>
                <Check aria-hidden="true" /> Professional chauffeur service
              </li>
              <li>
                <Check aria-hidden="true" /> Comfortable, luggage-aware travel
              </li>
              <li>
                <Check aria-hidden="true" /> O'Hare and Midway requests welcome
              </li>
            </ul>
            <Button asChild className="button-outline">
              <a href="#book">
                Request an airport ride <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
          </div>
          <div className="airport-image-wrap">
            <img
              src={airportImage}
              alt="Black executive sedan outside a glass airport terminal"
              width={1600}
              height={1104}
              loading="lazy"
            />
            <div className="airport-image-note">
              <span>Chicago airport travel</span>
              <strong>On your schedule.</strong>
            </div>
            <span className="airport-side-label">SKYRUN · AIRPORT TRANSFERS</span>
          </div>
        </div>
      </section>

      <section className="experience-band" aria-label="The Skyrun experience">
        <div className="experience-image" />
        <div className="experience-content page-width">
          <p className="eyebrow eyebrow-gold">The Skyrun experience</p>
          <h2>
            Comfort in motion.
            <br />
            <em>Confidence at every stop.</em>
          </h2>
          <div className="experience-values">
            <div>
              <span>01</span>
              <strong>Professional service</strong>
              <p>A polished experience shaped around courtesy and care.</p>
            </div>
            <div>
              <span>02</span>
              <strong>Comfort, considered</strong>
              <p>Space to settle in, focus, or simply enjoy the journey.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Your schedule</strong>
              <p>Share the details of your day and the timing that matters.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fleet-section section-dark" id="fleet">
        <div className="page-width">
          <div className="fleet-topline">
            <div>
              <p className="eyebrow eyebrow-gold">A considered ride</p>
              <h2>
                Our fleet.
                <br />
                <em>Your point of view.</em>
              </h2>
            </div>
            <p>
              Vehicle availability varies. Tell us about your party, luggage, and plans so we can
              discuss the right option.
            </p>
          </div>
          <div className="fleet-controls">
            <span>Vehicle preferences</span>
            <div>
              <button type="button" aria-label="Previous vehicle" onClick={() => moveFleet(-1)}>
                <ChevronLeft />
              </button>
              <button type="button" aria-label="Next vehicle" onClick={() => moveFleet(1)}>
                <ChevronRight />
              </button>
            </div>
          </div>
          <div className="fleet-track" ref={fleetTrack}>
            {fleet.map((v, i) => (
              <article className="fleet-slide fleet-slide-wide" key={v.name}>
                <img src={v.image} alt={v.alt} width={1600} height={1008} loading="lazy" />
                <div className="fleet-slide-caption">
                  <span>
                    0{i + 1} / {v.category}
                  </span>
                  <h3>{v.name}</h3>
                  <p>{v.description}</p>
                  <a className="text-link text-link-light" href="#book">
                    Request this vehicle <ArrowUpRight aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>
          <p className="fleet-footnote">
            Illustrative vehicle categories only. Specific vehicles and capacity are confirmed
            directly with Skyrun.
          </p>
        </div>
      </section>

      <section className="corporate-section section-light" id="corporate">
        <div className="corporate-layout page-width">
          <div className="corporate-photo">
            <img
              src={executiveImage}
              alt="Executive chauffeur service outside a downtown Chicago hotel"
              width={1600}
              height={1104}
              loading="lazy"
            />
            <span>Business travel, thoughtfully arranged</span>
          </div>
          <div className="corporate-copy">
            <p className="eyebrow">
              <BriefcaseBusiness aria-hidden="true" /> For the work in between
            </p>
            <h2>
              Business travel,
              <br />
              <em>without the distraction.</em>
            </h2>
            <span className="gold-rule" />
            <p>
              Make room for the meeting, the client, and everything your day requires. Request
              private transportation for executive travel, business meetings, and corporate events
              in Chicago.
            </p>
            <a className="text-link" href="#book">
              Request corporate transportation <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="occasion-section section-dark" id="occasions">
        <div className="occasion-photo">
          <img
            src={limoImage}
            alt="Black stretch limousine outside an elegant Chicago venue at night"
            width={1600}
            height={1008}
            loading="lazy"
          />
        </div>
        <div className="occasion-copy page-width">
          <p className="eyebrow eyebrow-gold">Make an entrance</p>
          <h2>
            Make the arrival
            <br />
            <em>part of the moment.</em>
          </h2>
          <p>
            For a celebration, an evening out, or another occasion worth making memorable, share
            your plans and request a ride that fits.
          </p>
          <div className="occasion-tags">
            <span>Weddings</span>
            <i /> <span>Celebrations</span>
            <i /> <span>Events</span>
            <i /> <span>Evenings</span>
          </div>
          <a className="text-link text-link-light" href="#book">
            Plan your ride <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="chicago-section" id="chicago">
        <img
          src={chicagoImage}
          alt="Chicago skyline and river at golden hour"
          width={1808}
          height={1008}
          loading="lazy"
        />
        <div className="chicago-shade" />
        <div className="chicago-copy page-width">
          <p className="eyebrow eyebrow-gold">
            <MapPin aria-hidden="true" /> Chicago, Illinois
          </p>
          <h2>
            Chicago,
            <br />
            <em>your journey starts here.</em>
          </h2>
          <p>
            From city streets to airport terminals and destinations beyond, tell us where you need
            to go.
          </p>
          <a className="text-link text-link-light" href="#book">
            Request your Chicago ride <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <span className="chicago-coordinates">
          O'Hare · Midway · Downtown Chicago · Destinations beyond
        </span>
      </section>

      <section className="story-section section-light" aria-label="Chicago, in motion">
        <div className="story-header page-width">
          <div>
            <p className="eyebrow">City, considered</p>
            <h2>Chicago, in motion.</h2>
          </div>
          <span>SKYRUN · FIELD NOTES</span>
        </div>
        <div className="story-strip">
          <figure>
            <img
              src={chicagoImage}
              alt="Downtown Chicago skyline in evening light"
              width={1808}
              height={1008}
              loading="lazy"
            />
            <figcaption>01 / The city</figcaption>
          </figure>
          <figure>
            <img
              src={heroImage}
              alt="Executive SUV arriving downtown in the evening"
              width={1920}
              height={1200}
              loading="lazy"
            />
            <figcaption>02 / The arrival</figcaption>
          </figure>
          <figure>
            <img
              src={airportImage}
              alt="Airport pickup with an executive sedan"
              width={1600}
              height={1104}
              loading="lazy"
            />
            <figcaption>03 / The departure</figcaption>
          </figure>
          <figure>
            <img
              src={executiveImage}
              alt="Chauffeur opening a car door at a city hotel"
              width={1600}
              height={1104}
              loading="lazy"
            />
            <figcaption>04 / The detail</figcaption>
          </figure>
        </div>
      </section>

      <section className="reviews-section section-dark" id="how-it-works">
        <div className="page-width">
          <div className="section-heading section-heading-light">
            <div>
              <p className="eyebrow eyebrow-gold">How booking works</p>
              <h2>
                Three steps.
                <br />
                <em>One smooth ride.</em>
              </h2>
            </div>
            <p>Clear, direct and personal — every ride is confirmed by the Skyrun team.</p>
          </div>
          <div className="steps-grid">
            {[
              [
                "01",
                "Send your request",
                "Use the form or call Vrund or Nisharg with your pickup, destination, date and passengers.",
              ],
              [
                "02",
                "We confirm directly",
                "Skyrun replies to confirm the vehicle, timing and price for your journey.",
              ],
              [
                "03",
                "Your chauffeur arrives",
                "Settle in. Airport, office, hotel or venue — the details are handled.",
              ],
            ].map(([n, t, d]) => (
              <div className="step-card" key={n}>
                <span>{n}</span>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section section-light" id="about">
        <div className="about-layout page-width">
          <div className="about-mark">
            <Brand />
            <span className="about-tagline">ELEVATE EVERY JOURNEY</span>
          </div>
          <div className="about-copy">
            <p className="eyebrow">The people behind the journey</p>
            <h2>
              Personal service.
              <br />
              <em>A Chicago point of view.</em>
            </h2>
            <p>
              Skyrun Limo is a Chicago, Illinois transportation company built around one simple
              idea: the ride should feel as considered as the destination. Tell us what you need,
              and our team will help coordinate the details.
            </p>
            <p className="about-footnote">
              Service, timing, and vehicle availability are confirmed when you contact Skyrun.
            </p>
            <div className="contact-people">
              {contacts.map((contact) => (
                <a href={`tel:${contact.href}`} key={contact.phone}>
                  <span>{contact.name}</span>
                  <strong>{contact.phone}</strong>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section section-light" id="faq">
        <div className="faq-layout page-width">
          <div>
            <p className="eyebrow">A few details</p>
            <h2>
              Good to
              <br />
              <em>know.</em>
            </h2>
            <p>Still have a question? Reach out and we'll help with the details.</p>
            <a className="text-link" href="#contact">
              Contact Skyrun <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <ChevronDown aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="booking-section" id="book">
        <div className="booking-heading page-width">
          <p className="eyebrow eyebrow-gold">
            <CalendarDays aria-hidden="true" /> Your next journey
          </p>
          <h2>
            Ready when
            <br />
            <em>you are.</em>
          </h2>
          <p>Share a few details and prepare a ride request for the Skyrun team.</p>
        </div>
        <div className="booking-form-wrap page-width">
          <BookingForm />
        </div>
      </section>

      <section className="contact-section section-light" id="contact">
        <div className="contact-layout page-width">
          <div>
            <p className="eyebrow">Let's talk details</p>
            <h2>
              Contact
              <br />
              <em>Skyrun.</em>
            </h2>
            <p>
              For a booking request or a question about your journey, call or email the Skyrun team.
            </p>
            <a className="email-link" href="mailto:skyrunlimo2428@gmail.com">
              skyrunlimo2428@gmail.com <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
          <div className="contact-card-list">
            {contacts.map((contact) => (
              <a className="contact-card" href={`tel:${contact.href}`} key={contact.phone}>
                <span>{contact.name}</span>
                <strong>{contact.phone}</strong>
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
            <div className="contact-card contact-card-static">
              <span>Location</span>
              <strong>Chicago, Illinois</strong>
              <MapPin aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <div className="mobile-book-bar">
        <a href="tel:+12246192024">
          <span>Call</span>
          <strong>Skyrun</strong>
        </a>
        <Button asChild className="button-gold">
          <a href="#book">
            Book your ride <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </div>
      <ChatWidget />
    </main>
  );
}
