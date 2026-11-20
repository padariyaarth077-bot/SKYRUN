import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PublicFleet } from "@/components/public-fleet";
import { fleetSelection, SPECIAL_FLEET } from "@/lib/public-fleet";
afterEach(cleanup);
it("keeps the homepage preview short and links to the complete fleet", () => {
  render(<PublicFleet preview />);
  const regular = screen.getByRole("region", { name: "Regular Fleet" });
  const special = screen.getByRole("region", { name: "Special Fleet" });
  expect(within(regular).getAllByRole("img")).toHaveLength(4);
  expect(within(special).getAllByRole("img")).toHaveLength(2);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("link", { name: /See approved airport rates/ })).toHaveAttribute(
    "href",
    "/fleet",
  );
  expect(screen.getByRole("link", { name: /Explore the Special Fleet/ })).toHaveAttribute(
    "href",
    "/fleet#special-fleet-heading",
  );
});
it("separates category pricing from named special requests and carries each selection", () => {
  render(<PublicFleet />);
  const regular = screen.getByRole("region", { name: "Regular Fleet" });
  const special = screen.getByRole("region", { name: "Special Fleet" });
  expect(within(regular).getAllByRole("img")).toHaveLength(4);
  expect(within(special).getAllByRole("img")).toHaveLength(13);
  expect(within(special).queryByRole("table")).toBeNull();
  expect(within(regular).queryByText(/Approval required/i)).toBeNull();
  expect(within(special).getAllByText(/Custom quote · By request/)).toHaveLength(
    SPECIAL_FLEET.length,
  );
  expect(within(regular).getByRole("table")).toHaveTextContent("$120 / ride");
  expect(within(regular).getByRole("table")).toHaveTextContent("$150 / ride");
  for (const link of screen.getAllByRole("link")) {
    const url = new URL(link.getAttribute("href")!, "http://localhost");
    const selection = fleetSelection(url.searchParams.get("vehicle"));
    expect(selection).toBeDefined();
    expect(selection?.special).toBe(special.contains(link));
    expect(url.pathname).toBe("/book");
  }
  expect(screen.queryByText(/Instant Booking|Book Now/)).toBeNull();
});
it("filters both groups and rejects unrecognized query parameters", () => {
  render(<PublicFleet search="phantom" />);
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getByText("No matching regular categories.")).toBeInTheDocument();
  expect(fleetSelection("Rolls-Royce Phantom")?.special).toBe(true);
  expect(fleetSelection("Luxury SUV")?.special).toBe(false);
  expect(fleetSelection("invented vehicle")).toBeUndefined();
  expect(fleetSelection(["Luxury SUV"])).toBeUndefined();
});

it("keeps image-source and internal pricing notes out of public copy", () => {
  const { container } = render(<PublicFleet />);
  expect(container.textContent).not.toMatch(
    /illustrative|stock photo|category example|supplied|representative|demo|sample|placeholder|client-approved|temporary/i,
  );
  for (const image of screen.getAllByRole("img")) {
    expect(image.getAttribute("alt")).not.toMatch(/supplied|representative|stock/i);
  }
});
