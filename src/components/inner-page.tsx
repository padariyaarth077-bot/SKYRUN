import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingForm, faqs } from "@/components/skyrun-site";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export type Block = { title: string; body: string; items?: string[] };

export function InnerPage({
  eyebrow,
  title,
  accent,
  intro,
  image,
  blocks = [],
  showForm,
  showFaq,
  legal,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  intro: string;
  image?: string;
  blocks?: Block[];
  showForm?: boolean;
  showFaq?: boolean;
  legal?: boolean;
}) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden section-dark">
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <div className="page-width relative py-24 md:py-32">
          <p className="eyebrow eyebrow-gold">{eyebrow}</p>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-4">
            {title}
            {accent && (
              <>
                <br />
                <em>{accent}</em>
              </>
            )}
          </h1>
          <span className="gold-rule" />
          <p className="max-w-xl mt-6 opacity-85 text-lg">{intro}</p>
        </div>
      </section>

      {blocks.length > 0 && (
        <section className="page-width py-20 grid gap-10 md:grid-cols-2">
          {blocks.map((b) => (
            <article
              key={b.title}
              className={legal ? "md:col-span-2 max-w-3xl" : "border-t border-border pt-6"}
            >
              <h2 className="font-display text-3xl">{b.title}</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed text-base">{b.body}</p>
              {b.items && (
                <ul className="mt-4 space-y-2 text-base">
                  {b.items.map((i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-primary">—</span>
                      {i}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      )}

      {showFaq && (
        <section className="page-width py-16 max-w-3xl faq-list">
          {faqs.map((f) => (
            <details key={f.question}>
              <summary>
                {f.question}
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </section>
      )}

      {showForm && (
        <section className="page-width py-16 max-w-3xl">
          <div className="section-dark p-6 md:p-10">
            <BookingForm />
          </div>
        </section>
      )}

      {!legal && !showForm && (
        <section className="section-dark">
          <div className="page-width py-16 flex flex-wrap items-center justify-between gap-6">
            <h2 className="font-display text-4xl">Ready when you are.</h2>
            <div className="flex gap-4 flex-wrap">
              <Button asChild className="button-gold button-large">
                <Link to="/book">
                  Request a ride <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
              <a className="text-link text-link-light" href="tel:+12246192024">
                Call 224-619-2024
              </a>
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
