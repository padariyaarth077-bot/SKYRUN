import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, X } from "lucide-react";
import { HEADER_LOGO } from "@/lib/branding";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISSAL_KEY = "skyrun-newsletter-dismissed-until";
const DISMISSAL_DAYS = 7;
const SLIDE_INTERVAL_MS = 5000;

const fleetSlides = [
  {
    src: "/vehicle-images/cadillac-escalade-esv-1.jpg",
    alt: "Cadillac Escalade ESV from the Skyrun fleet",
    caption: "Room to arrive together",
  },
  {
    src: "/vehicle-images/regular-sedan.jpg",
    alt: "Skyrun regular sedan",
    caption: "Comfort for everyday journeys",
  },
  {
    src: "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg",
    alt: "Mercedes-Benz executive Sprinter van",
    caption: "Space for the whole group",
  },
  {
    src: "/vehicle-images/rolls-royce-phantom.jpg",
    alt: "Rolls-Royce Phantom from the Skyrun special fleet",
    caption: "A distinguished arrival",
  },
];

function wasRecentlyDismissed() {
  try {
    const dismissedUntil = Number(window.localStorage.getItem(DISMISSAL_KEY));
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
  } catch {
    return false;
  }
}

function saveDismissal() {
  try {
    const dismissedUntil = Date.now() + DISMISSAL_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(DISMISSAL_KEY, String(dismissedUntil));
  } catch {
    // The popup can still be dismissed for this visit when browser storage is unavailable.
  }
}

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(1);
  const [transitioning, setTransitioning] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const slideCount = fleetSlides.length;
  const loopSlides = [fleetSlides[slideCount - 1]!, ...fleetSlides, fleetSlides[0]!];
  const activeIndex = (position - 1 + slideCount) % slideCount;

  const dismiss = useCallback(() => {
    saveDismissal();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (wasRecentlyDismissed()) return;
    const timer = window.setTimeout(() => setOpen(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open || reducedMotion) return;
    const timer = window.setInterval(() => {
      setPosition((current) => current + 1);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, reducedMotion]);

  useEffect(() => {
    if (position !== 0 && position !== slideCount + 1) return;
    const timer = window.setTimeout(() => {
      setTransitioning(false);
      setPosition(position === 0 ? slideCount : 1);
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => setTransitioning(true)),
      );
    }, 650);
    return () => window.clearTimeout(timer);
  }, [position, slideCount]);

  function requestSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent("Skyrun Limo email updates");
    const body = encodeURIComponent(
      `Please add ${email.trim()} to the Skyrun Limo email updates list. I agree to receive occasional service updates and travel notes.`,
    );
    window.location.href = `mailto:skyrunlimo2428@gmail.com?subject=${subject}&body=${body}`;
    setFeedback("Your email app will open with a signup request. Send the message to complete it.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss();
        else setOpen(true);
      }}
    >
      <DialogPortal>
        <DialogOverlay className="newsletter-overlay" />
        <DialogPrimitive.Content
          className="newsletter-dialog"
          aria-describedby="newsletter-description"
        >
          <div className="newsletter-carousel" aria-label="Skyrun fleet photos">
            <div
              className={`newsletter-carousel-track${transitioning ? " is-transitioning" : ""}`}
              style={{ transform: `translateX(-${position * 100}%)` }}
            >
              {loopSlides.map((slide, index) => (
                <img key={`${slide.src}-${index}`} src={slide.src} alt={slide.alt} />
              ))}
            </div>
            <span className="newsletter-carousel-shade" aria-hidden="true" />
            <p className="newsletter-carousel-caption">{fleetSlides[activeIndex]?.caption}</p>
          </div>

          <div className="newsletter-popup-content">
            <DialogClose className="newsletter-close" aria-label="Close newsletter popup">
              <X aria-hidden="true" />
            </DialogClose>
            <img className="newsletter-logo" src={HEADER_LOGO} alt="Skyrun Limo" />
            <p className="newsletter-eyebrow">A little more from Skyrun</p>
            <DialogTitle className="newsletter-title">Travel notes, worth opening.</DialogTitle>
            <DialogDescription id="newsletter-description" className="newsletter-description">
              Occasional service updates, seasonal travel notes, and a closer look at getting around
              Chicago with Skyrun.
            </DialogDescription>
            <form className="newsletter-form" onSubmit={requestSignup}>
              <label htmlFor="skyrun-newsletter-email">Email address</label>
              <input
                id="skyrun-newsletter-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className="newsletter-submit" type="submit">
                Request updates <ArrowRight aria-hidden="true" />
              </button>
            </form>
            <p className="newsletter-consent">
              Continue by email to request occasional Skyrun updates. Nothing is sent until you send
              the email draft.
            </p>
            {feedback && (
              <p className="newsletter-feedback" role="status">
                {feedback}
              </p>
            )}
            <button className="newsletter-later" type="button" onClick={dismiss}>
              Maybe later
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
