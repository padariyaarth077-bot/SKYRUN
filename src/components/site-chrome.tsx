import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HEADER_LOGO } from "@/lib/branding";
import { NewsletterPopup } from "@/components/newsletter-popup";

export const navLinks = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/fleet", "Fleet"],
  ["/airport-transfer", "Airport"],
  ["/corporate-transportation", "Corporate"],
  ["/about", "About"],
  ["/contact", "Contact"],
] as const;

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? " brand-light" : ""}`} to="/" aria-label="Skyrun Limo home">
      <img
        src={HEADER_LOGO}
        className="official-brand-logo"
        alt="Skyrun Limo — Premium Limo Service"
        width="512"
        height="512"
      />
      <span className="official-brand-label" aria-hidden="true">
        SKYRUN LIMO<span>CHICAGO</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const solid = !overlay || scrolled;

  return (
    <header
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
      className={`site-header${overlay ? "" : " site-header-static"}${solid ? " site-header-scrolled" : ""}`}
    >
      <div className="header-inner">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Brand light={!solid} />
        <nav
          className={`main-nav${menuOpen ? " main-nav-open" : ""}`}
          id="public-navigation"
          aria-label="Main navigation"
        >
          {navLinks.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              activeProps={{ className: "nav-active" }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-phone" href="tel:+12246192024">
            Call Skyrun
          </a>
          <Button asChild className="button-gold header-book">
            <Link to="/book">
              Book a Ride <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="public-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main page-width">
        <div className="footer-brand">
          <Brand light />
          <p>CHICAGO. YOUR WAY.</p>
          <span>Private chauffeur transportation across Chicago and surrounding suburbs.</span>
          <p className="footer-services">
            Airport transfers · Corporate travel · Hourly rides · Special occasions
          </p>
          <div className="footer-socials" aria-label="Follow Skyrun Limo">
            <span>Follow Skyrun</span>
            <div>
              <a href="https://www.facebook.com/" aria-label="Find Skyrun Limo on Facebook">
                <Facebook aria-hidden="true" />
              </a>
              <a href="https://www.instagram.com/" aria-label="Find Skyrun Limo on Instagram">
                <Instagram aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-nav">
          <span>Explore</span>
          <Link to="/services">Services</Link>
          <Link to="/fleet">Fleet</Link>
          <Link to="/airport">Airport</Link>
          <Link to="/corporate">Corporate</Link>
          <Link to="/occasions">Special occasions</Link>
          <Link to="/service-areas">Service areas</Link>
        </div>
        <div className="footer-nav">
          <span>Skyrun</span>
          <Link to="/about">About</Link>
          <Link to="/faq">FAQs</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/book">Book a ride</Link>
          <a href="/policies">Policies & information</a>
        </div>
        <div className="footer-contact">
          <span>Reach the team</span>
          <a href="tel:+12246192024">
            <Phone aria-hidden="true" /> Vrund Patel — 224-619-2024
          </a>
          <a href="tel:+17792406371">
            <Phone aria-hidden="true" /> Nisharg Patel — 779-240-6371
          </a>
          <a href="mailto:skyrunlimo2428@gmail.com">
            <Mail aria-hidden="true" /> skyrunlimo2428@gmail.com
          </a>
          <p className="footer-location">
            <MapPin aria-hidden="true" /> Chicago, Illinois
          </p>
          <Button asChild className="button-gold">
            <Link to="/book">
              Book a Ride <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      <nav className="footer-policies page-width" aria-label="Policy links">
        <a href="/privacy-policy">Privacy Policy</a>
        <a href="/terms-and-conditions">Terms & Conditions</a>
        <a href="/refund-policy">Refund Policy</a>
        <a href="/cookie-policy">Cookie Policy</a>
        <a href="/chauffeur-service-policy">Chauffeur Service & Booking Policy</a>
      </nav>
      <div className="footer-bottom page-width">
        <span>© {new Date().getFullYear()} SKYRUN LIMO LLC</span>
        <span>CHICAGO, ILLINOIS</span>
        <Link to="/">Back to top ↑</Link>
      </div>
      <NewsletterPopup />
    </footer>
  );
}
