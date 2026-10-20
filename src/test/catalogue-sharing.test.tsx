import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogueShare } from "@/components/catalogue-share";
import { VehicleCatalogue } from "@/components/vehicle-catalogue";
import { catalogueUrl, whatsappNumber, whatsappCatalogueLink } from "@/lib/catalogue-sharing";
beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);
it.each(["+1 (202) 555-0188", "0012025550188"])(
  "normalizes an explicitly international phone %s",
  (phone) => expect(whatsappNumber(phone)).toBe("12025550188"),
);
it.each([
  null,
  "",
  "2025550188",
  "+0123456789",
  "+12025550188 ext 2",
  "https://example.test",
  "+1234567890123456",
])("rejects ambiguous/unsupported WhatsApp phone %s", (phone) =>
  expect(whatsappNumber(phone)).toBeNull(),
);
it("builds only a public catalogue link and encoded WhatsApp draft", () => {
  const result = new URL(
    whatsappCatalogueLink("https://skyrunlimo.com/admin/customers", "+12025550188")!,
  );
  expect(result.origin).toBe("https://wa.me");
  expect(result.pathname).toBe("/12025550188");
  expect(result.searchParams.get("text")).toContain("https://skyrunlimo.com/catalogue");
  expect(result.searchParams.get("text")).not.toContain("/admin");
  expect(catalogueUrl("https://skyrunlimo.com/anything?token=private")).toBe(
    "https://skyrunlimo.com/catalogue",
  );
});
it("permits sharing without a recipient but never guesses a missing customer phone", () => {
  expect(whatsappCatalogueLink("https://skyrunlimo.com")).toMatch(/^https:\/\/wa.me\/\?text=/);
  expect(whatsappCatalogueLink("https://skyrunlimo.com", null)).toBeNull();
  expect(() => catalogueUrl("javascript:alert(1)")).toThrow();
});
it("explains invalid contact numbers without exposing an active WhatsApp link", () => {
  render(<CatalogueShare phone="2025550188" />);
  expect(screen.getByRole("button", { name: "Open WhatsApp" })).toBeDisabled();
  expect(screen.getByText(/No country code is assumed/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open WhatsApp" })).toBeNull();
});
it("copies the public URL and never says the message was sent", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<CatalogueShare phone="+12025550188" />);
  fireEvent.click(screen.getByRole("button", { name: "Copy catalogue link" }));
  await screen.findByText("Catalogue link copied.");
  expect(writeText).toHaveBeenCalledWith(window.location.origin + "/catalogue");
  expect(screen.getByRole("link", { name: "Open WhatsApp" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.getByText(/does not mean a message was sent or delivered/)).toBeInTheDocument();
});
it("shows clipboard failure honestly", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(Error("blocked")) },
  });
  render(<CatalogueShare />);
  fireEvent.click(screen.getByRole("button", { name: "Copy catalogue link" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Could not copy");
});
it("public catalogue shows photos/models without internal quantities or customer records", () => {
  render(<VehicleCatalogue />);
  expect(screen.getAllByRole("img")).toHaveLength(14);
  expect(screen.getByRole("heading", { name: "Cadillac Escalade ESV" })).toBeInTheDocument();
  expect(screen.queryByText(/Quantity not recorded/)).toBeNull();
  expect(screen.getByText(/availability are confirmed/)).toBeInTheDocument();
});
it("searches model names and distinguishes no results", () => {
  const { rerender } = render(<VehicleCatalogue search="Cadillac" />);
  expect(screen.getAllByRole("img")).toHaveLength(2);
  rerender(<VehicleCatalogue search="no such model" />);
  expect(screen.getByText("No models match this search.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
});
