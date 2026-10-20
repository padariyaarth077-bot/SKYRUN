import { useState } from "react";
import { useOperationsPermission, useOperationsSave } from "@/lib/operations-hooks";
import { customerContactSchema, type Customer } from "@/lib/phase5";

export function CustomerContactEditor({
  customer,
  onSaved,
}: {
  customer: Customer;
  onSaved: () => void;
}) {
  const permission = useOperationsPermission(customer.business_unit_id);
  const { save, pending, message } = useOperationsSave(onSaved);
  const [form, setForm] = useState({
    full_name: customer.full_name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    company_name: customer.company_name ?? "",
    notes: customer.notes ?? "",
  });
  const [invalid, setInvalid] = useState(false);
  if (permission === "loading")
    return (
      <p role="status" className="p-4">
        Checking edit permission…
      </p>
    );
  if (permission !== "allowed")
    return (
      <p className="p-4" role={permission === "error" ? "alert" : undefined}>
        {permission === "error"
          ? "Contact editing is unavailable. The approved Phase 5 database update and a permission check are required."
          : "Contact details are read-only for your role."}
      </p>
    );
  return (
    <form
      className="space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = customerContactSchema.safeParse(form);
        setInvalid(!parsed.success);
        if (parsed.success)
          void save(
            "customer",
            customer.id,
            customer.business_unit_id,
            parsed.data,
            customer.updated_at,
          );
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        {(
          [
            ["full_name", "Full name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["company_name", "Company"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            {label}
            <input
              required={key === "full_name"}
              type={key === "email" ? "email" : "text"}
              maxLength={key === "email" ? 254 : key === "phone" ? 30 : 200}
              className="block w-full rounded border p-2"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block">
          Customer notes
          <textarea
            maxLength={4000}
            className="block w-full rounded border p-2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" type="submit">
          {pending ? "Saving…" : "Save contact details"}
        </button>
      </fieldset>
      {invalid && (
        <p role="alert">
          Enter a name, valid email/phone or leave contact fields blank. Check field lengths.
        </p>
      )}
      {message && <p role={message === "Saved." ? "status" : "alert"}>{message}</p>}
      <p className="text-sm text-muted-foreground">
        Changes update this customer only. Existing quote and booking snapshots are preserved.
      </p>
    </form>
  );
}
