import { ArrowUpRight, FileText } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { POLICIES, type PolicySlug } from "@/lib/policy-content";
import { publicSeo } from "@/lib/seo";

export function policyHead(slug: PolicySlug) {
  const title = `${POLICIES[slug].title} | Skyrun Limo`;
  const description = `Read Skyrun Limo’s ${POLICIES[slug].title.toLowerCase()} and information about chauffeur service enquiries.`;
  return publicSeo(`/${slug}`, title, description);
}

export function PolicyPage({ slug }: { slug: PolicySlug }) {
  const policy = POLICIES[slug];
  return (
    <div className="public-site policy-page">
      <SiteHeader />
      <main id="main-content">
        <section className="policy-hero">
          <div className="page-width">
            <p className="mobility-kicker">SKYRUN · POLICIES & INFORMATION</p>
            <h1>{policy.title}</h1>
            <p>Information for your journey and your relationship with Skyrun.</p>
          </div>
        </section>
        <div className="page-width policy-layout">
          <aside className="policy-sidebar">
            <nav aria-label="Skyrun policies">
              <a href="/policies" className="policy-hub-link">
                All policies
              </a>
              {Object.values(POLICIES).map((item) => (
                <a
                  key={item.slug}
                  href={`/${item.slug}`}
                  aria-current={item.slug === slug ? "page" : undefined}
                >
                  {item.title}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ))}
            </nav>
            <details>
              <summary>On this page</summary>
              <nav aria-label="Policy sections">
                {policy.sections.map((section, index) => (
                  <a href={`#policy-section-${index + 1}`} key={section.heading}>
                    {section.heading}
                  </a>
                ))}
              </nav>
            </details>
          </aside>
          <article className="policy-document">
            {policy.sections.map((section, index) => (
              <section id={`policy-section-${index + 1}`} key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </section>
            ))}
            <div className="policy-related-note">
              <strong>Related cancellation information</strong>
              <p>
                For cancellation deadlines and any applicable fees, please contact our team and
                review the terms provided with your booking.
              </p>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function PolicyHub() {
  return (
    <div className="public-site policy-page">
      <SiteHeader />
      <main id="main-content">
        <section className="policy-hero">
          <div className="page-width">
            <p className="mobility-kicker">BEFORE YOUR JOURNEY</p>
            <h1>Policies & information.</h1>
            <p>Review our privacy, booking and service policies.</p>
          </div>
        </section>
        <section className="page-width policy-hub-content">
          <div className="policy-card-grid">
            {Object.values(POLICIES).map((policy) => (
              <a href={`/${policy.slug}`} key={policy.slug} className="policy-link-card">
                <FileText size={26} aria-hidden="true" />
                <h2>{policy.title}</h2>
                <span>
                  Read policy <ArrowUpRight size={19} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
