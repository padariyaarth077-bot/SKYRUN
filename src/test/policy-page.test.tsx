import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { POLICIES, type PolicySlug } from "@/lib/policy-content";
import { PolicyHub, PolicyPage } from "@/components/policy-page";
vi.mock("@/components/site-chrome", () => ({ SiteHeader: () => null, SiteFooter: () => null }));
afterEach(cleanup);
const expected: Record<PolicySlug, number> = {
  "privacy-policy": 17,
  "terms-and-conditions": 22,
  "refund-policy": 16,
  "cookie-policy": 11,
  "chauffeur-service-policy": 19,
};
it.each(Object.keys(expected) as PolicySlug[])(
  "renders customer-facing %s content with current contacts",
  (slug) => {
    const policy = POLICIES[slug];
    render(<PolicyPage slug={slug} />);
    const article = screen.getByRole("article");
    expect(article.querySelectorAll("section")).toHaveLength(expected[slug]);
    expect(article).toHaveTextContent("224-619-2024");
    expect(article).toHaveTextContent("779-240-6371");
    expect(article).not.toHaveTextContent("872) 300-2173");
    expect(article).not.toHaveTextContent("630) 237-8726");
    expect(article.textContent).not.toMatch(
      /\[INSERT|publication review|draft|supplied|client decision|client confirmation|before publication|finalized/i,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(policy.title);
    expect(screen.queryByRole("link", { name: "View original PDF" })).toBeNull();
    expect(article).toHaveTextContent("For cancellation deadlines");
  },
);
it("lists exactly the five supplied policies without inventing a cancellation policy", () => {
  render(<PolicyHub />);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(5);
  for (const slug of Object.keys(expected))
    expect(links.some((link) => link.getAttribute("href") === `/${slug}`)).toBe(true);
});
