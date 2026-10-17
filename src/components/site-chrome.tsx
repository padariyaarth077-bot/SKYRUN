import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const navLinks = [
  ["/services", "Services"],
  ["/fleet", "Fleet"],
  ["/airport", "Airport"],
  ["/corporate", "Corporate"],
  ["/occasions", "Occasions"],
  ["/service-areas", "Service areas"],
  ["/about", "About"],
  ["/contact", "Contact"],
] as const;

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? " brand-light" : ""}`} to="/" aria-label="Skyrun Limo home">
      <span className="brand-name">SKYRUN</span>
      <span className="brand-sub">LIMO LLC</span>
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
      className={`site-header${overlay ? "" : " site-header-static"}${solid ? " site-header-scrolled" : ""}`}
    >
      <div className="header-inner">
        <Brand light={!solid} />
        <nav className={`main-nav${menuOpen ? " main-nav-open" : ""}`} aria-label="Main navigation">
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
              Book now <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
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
          <p>ELEVATE EVERY JOURNEY.</p>
          <span>
            Private chauffeur transportation
            <br />
            Chicago, Illinois
          </span>
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
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/terms-and-conditions">Terms</Link>
        </div>
        <div className="footer-contact">
          <span>Reach the team</span>
          <a href="tel:+12246192024">Vrund Patel — 224-619-2024</a>
          <a href="tel:+17792406371">Nisharg Patel — 779-240-6371</a>
          <a href="mailto:skyrunlimo2428@gmail.com">skyrunlimo2428@gmail.com</a>
          <Button asChild className="button-gold">
            <Link to="/book">
              Request a ride <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="footer-bottom page-width">
        <span>© {new Date().getFullYear()} SKYRUN LIMO LLC</span>
        <span>CHICAGO, ILLINOIS</span>
        <Link to="/">Back to top ↑</Link>
      </div>
    </footer>
  );
}
