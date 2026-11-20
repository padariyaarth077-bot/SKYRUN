export function EnquiryConfirmation({
  reference,
  contactOnly = false,
}: {
  reference: string;
  contactOnly?: boolean;
}) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-800"
    >
      <strong className="block">
        {contactOnly ? "Contact Enquiry Submitted" : "Enquiry Submitted Successfully!"}
      </strong>
      <p className="my-2">
        Thank you for sharing your {contactOnly ? "contact details" : "details"} with Skyrun Limo.
        Our team will review your {contactOnly ? "message" : "request"} and contact you shortly.
      </p>
      <p className="my-2">
        <strong>Enquiry Reference:</strong>{" "}
        <span className="break-all font-semibold">{reference}</span>
      </p>
      <p className="mb-0">Your enquiry is awaiting review; your ride is not yet confirmed.</p>
    </div>
  );
}
