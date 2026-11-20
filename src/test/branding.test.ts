import { expect, it } from "vitest";
import { emailBrandingHtml, OFFICIAL_LOGO } from "@/lib/branding";
import { regularConfirmationTemplate } from "@/lib/regular-confirmation";
it("keeps unpublished email assets optional and allows only the verified official HTTPS path", () => {
  expect(emailBrandingHtml()).not.toContain("<img");
  expect(emailBrandingHtml("https://www.skyrunlimo.com" + OFFICIAL_LOGO)).toContain(
    'width="144" height="144"',
  );
  for (const url of [
    "http://www.skyrunlimo.com" + OFFICIAL_LOGO,
    "https://evil.test" + OFFICIAL_LOGO,
    "https://www.skyrunlimo.com/old.png",
    "https://user@www.skyrunlimo.com" + OFFICIAL_LOGO,
    "https://www.skyrunlimo.com" + OFFICIAL_LOGO + "?x=1",
  ])
    expect(() => emailBrandingHtml(url)).toThrow();
});
it("adds approved branding without changing confirmation facts or payment wording", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "REGULAR_BOOKING_CONFIRMED",
    recipient: "test@example.test",
    payload: {
      reference: "RB-TEST",
      name: "Test",
      status: "CONFIRMED",
      travelDate: "2099-11-06",
      pickupTime: "14:30",
      pickup: "ORD",
      dropoff: "Chicago",
      category: "Regular Sedan",
      amount: 125,
      currency: "USD",
      paymentStatus: "NOT_REQUESTED",
      timeZone: "America/Chicago",
    },
  };
  const before = regularConfirmationTemplate(row),
    after = regularConfirmationTemplate(row, "https://www.skyrunlimo.com" + OFFICIAL_LOGO);
  expect(after.text).toBe(before.text);
  expect(after.subject).toBe(before.subject);
  expect(after.to).toBe(before.to);
  expect(after.html).toContain(OFFICIAL_LOGO);
  expect(after.html).toContain("not a payment receipt");
});
