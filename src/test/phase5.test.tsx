import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CustomerContactEditor } from "@/components/operations-editor";
import { ServiceConfiguration } from "@/components/service-configuration";
import { FleetImages } from "@/components/fleet-images";
import {
  customerContactSchema,
  configurationSchema,
  possibleDuplicates,
  type Customer,
} from "@/lib/phase5";
import { VEHICLE_IMAGES, VEHICLE_MODELS, knownVehicleImage } from "@/lib/vehicle-images";
import { existsSync } from "node:fs";
import type { ReactNode } from "react";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({
    children,
    title,
    actions,
  }: {
    children: ReactNode;
    title: string;
    actions: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
  Panel: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  business_unit_id: "unit",
  full_name: "Test Customer",
  email: "test@example.test",
  phone: "+12025550188",
  company_name: null,
  notes: null,
  updated_at: "2026-10-21T12:00:00Z",
} as Customer;
const valid = {
  full_name: "Test Customer",
  email: "test@example.test",
  phone: "+12025550188",
  company_name: "",
  notes: "",
};
beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockImplementation((name) =>
    Promise.resolve({ data: name === "can_manage_operations" ? true : customer.id, error: null }),
  );
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  }));
});
afterEach(cleanup);
it("groups alternate model photos without inventing car quantities or capacities", () => {
  expect(VEHICLE_MODELS).toHaveLength(13);
  expect(
    VEHICLE_MODELS.find((model) => model.name === "Cadillac Escalade ESV")?.photos,
  ).toHaveLength(2);
  expect(VEHICLE_MODELS.flatMap((model) => model.photos)).toHaveLength(14);
  expect(
    VEHICLE_MODELS.every((model) => !("quantity" in model) && !("passenger_capacity" in model)),
  ).toBe(true);
});
it.each([
  { ...valid, full_name: " " },
  { ...valid, email: "not-email" },
  { ...valid, phone: "abcdefg" },
  { ...valid, phone: "1" },
  { ...valid, phone: "-------" },
  { ...valid, notes: "x".repeat(4001) },
  { ...valid, business_unit_id: "other" },
])("rejects invalid or extra customer input %#", (value) =>
  expect(customerContactSchema.safeParse(value).success).toBe(false),
);
it("permits explicitly blank optional contact fields", () =>
  expect(customerContactSchema.safeParse({ ...valid, email: "", phone: "" }).success).toBe(true));
it.each([
  { name: " ", description: "", is_active: true },
  { name: "x", description: "", is_active: "true" },
  { name: "x", description: "", is_active: true, price: 1 },
])("rejects invalid configuration %#", (value) =>
  expect(configurationSchema.safeParse(value).success).toBe(false),
);
it("suggests same-unit normalized contacts/names without merging", () => {
  const other = {
    ...customer,
    id: "other",
    phone: "+1 (202) 555-0188",
    full_name: "Another",
    email: null,
  };
  expect(
    possibleDuplicates(customer, [
      customer,
      other,
      { ...other, id: "cross", business_unit_id: "other-unit" },
    ]).map((r) => r.id),
  ).toEqual(["other"]);
  expect(
    possibleDuplicates(customer, [
      { ...customer, id: "name", full_name: "  test   CUSTOMER ", email: null, phone: null },
    ]),
  ).toHaveLength(1);
  expect(other.id).toBe("other");
});
it("does not match blank contact fields or blank names", () =>
  expect(
    possibleDuplicates({ ...customer, full_name: "", email: null, phone: null }, [
      { ...customer, id: "other", full_name: "", email: null, phone: null },
    ]),
  ).toEqual([]));
it("includes all 14 existing photo files and rejects arbitrary URLs", () => {
  expect(VEHICLE_IMAGES).toHaveLength(14);
  for (const image of VEHICLE_IMAGES) {
    expect(existsSync("public" + image.path)).toBe(true);
    expect(knownVehicleImage(image.path)).toBe(image.path);
  }
  expect(knownVehicleImage("https://other.example/image.jpg")).toBeNull();
  expect(knownVehicleImage(null)).toBeNull();
});
it("hides customer mutations when permission fails", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private database text" } });
  render(<CustomerContactEditor customer={customer} onSaved={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  expect(screen.queryByRole("button", { name: "Save contact details" })).toBeNull();
  expect(screen.queryByText("private database text")).toBeNull();
});
it("shows read-only customer access for non-manager staff", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  render(<CustomerContactEditor customer={customer} onSaved={vi.fn()} />);
  await screen.findByText("Contact details are read-only for your role.");
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("preserves failed contact edits, uses the same retry operation and refreshes after confirmed save", async () => {
  const saved = vi.fn();
  rpc.mockImplementation((name) =>
    Promise.resolve(
      name === "can_manage_operations"
        ? { data: true, error: null }
        : { data: null, error: { message: "private" } },
    ),
  );
  render(<CustomerContactEditor customer={customer} onSaved={saved} />);
  const name = await screen.findByLabelText("Full name");
  fireEvent.change(name, { target: { value: "Edited customer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact details" }));
  await screen.findByRole("alert");
  expect(name).toHaveValue("Edited customer");
  expect(saved).not.toHaveBeenCalled();
  const first = rpc.mock.calls.find((call) => call[0] === "phase5_save")?.[1];
  rpc.mockResolvedValue({ data: customer.id, error: null });
  fireEvent.click(screen.getByRole("button", { name: "Save contact details" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  const calls = rpc.mock.calls.filter((call) => call[0] === "phase5_save");
  expect(calls[1]?.[1]._operation_id).toBe(first._operation_id);
  expect(first).toMatchObject({
    _business_unit_id: "unit",
    _expected_updated_at: customer.updated_at,
    _payload: { full_name: "Edited customer" },
  });
});
it("blocks rapid contact duplicate submissions while pending", async () => {
  let resolve!: (value: unknown) => void;
  rpc.mockImplementation((name) =>
    name === "can_manage_operations"
      ? Promise.resolve({ data: true, error: null })
      : new Promise((r) => {
          resolve = r;
        }),
  );
  const saved = vi.fn();
  render(<CustomerContactEditor customer={customer} onSaved={saved} />);
  const button = await screen.findByRole("button", { name: "Save contact details" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(rpc.mock.calls.filter((call) => call[0] === "phase5_save")).toHaveLength(1);
  expect(screen.getByLabelText("Full name")).toBeDisabled();
  resolve({ data: customer.id, error: null });
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
});
it("keeps database uniqueness errors safe and does not pretend to save", async () => {
  rpc.mockImplementation((name) =>
    Promise.resolve(
      name === "can_manage_operations"
        ? { data: true, error: null }
        : { data: null, error: { code: "23505", message: "private email" } },
    ),
  );
  const saved = vi.fn();
  render(<CustomerContactEditor customer={customer} onSaved={saved} />);
  fireEvent.click(await screen.findByRole("button", { name: "Save contact details" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  expect(saved).not.toHaveBeenCalled();
});
it("shows configuration loading failure distinctly from an empty catalogue", async () => {
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: null, error: { message: "private" } }),
  }));
  render(<ServiceConfiguration kind="service" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  expect(screen.queryByText(/No configuration matches/)).toBeNull();
});
it("saves real scoped configuration and clears only after success", async () => {
  let rows: unknown[] = [];
  from.mockImplementation((table) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: table === "business_units" ? [{ id: "unit", name: "Limousine unit" }] : rows,
        error: null,
      }),
    ),
  }));
  rpc.mockImplementation((name, args) => {
    if (name === "can_manage_operations") return Promise.resolve({ data: true, error: null });
    rows = [
      {
        id: args._id,
        business_unit_id: "unit",
        kind: "service",
        ...args._payload,
        updated_at: "2026-10-21T12:00:00Z",
      },
    ];
    return Promise.resolve({ data: args._id, error: null });
  });
  render(<ServiceConfiguration kind="service" />);
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Airport transfer" } });
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  await screen.findByRole("button", { name: "Airport transfer" });
  expect(await screen.findByLabelText("Name")).toHaveValue("");
  expect(rpc.mock.calls.find((call) => call[0] === "phase5_save")?.[1]).toMatchObject({
    _kind: "service",
    _business_unit_id: "unit",
    _expected_updated_at: null,
  });
});
it("displays existing fleet records and requires an explicit image choice", async () => {
  from.mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: [
        {
          id: customer.id,
          business_unit_id: "unit",
          make: "Cadillac",
          model: "Escalade ESV",
          status: "ACTIVE",
          updated_at: customer.updated_at,
        },
      ],
      error: null,
    }),
  }));
  render(<FleetImages kind="vehicle" />);
  await screen.findAllByText("Cadillac Escalade ESV");
  expect(screen.getByText("Fleet model catalogue (13 models / groups)")).toBeInTheDocument();
  const picker = await screen.findByLabelText("Reference photo");
  expect(picker).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save reference photo" })).toBeDisabled();
  fireEvent.change(picker, { target: { value: VEHICLE_IMAGES[0].path } });
  expect(screen.getByRole("button", { name: "Save reference photo" })).toBeEnabled();
  expect(
    screen.getByRole("img", { name: "Cadillac Escalade ESV — selected reference photo" }),
  ).toHaveAttribute("src", VEHICLE_IMAGES[0].path);
});
