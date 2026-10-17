import { describe, expect, it } from "vitest";
import {
  CHAT_MAX_MESSAGE_LENGTH,
  chatContactSchema,
  chatMessageSchema,
  fallbackReply,
} from "@/lib/chat.shared";

const session = "A".repeat(43);

describe("chat input boundaries", () => {
  it("accepts a bounded visitor message and rejects an oversized one", () => {
    expect(chatMessageSchema.safeParse({ session, message: "Airport pickup" }).success).toBe(true);
    expect(
      chatMessageSchema.safeParse({ session, message: "x".repeat(CHAT_MAX_MESSAGE_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it("requires valid contact details before a chat lead is created", () => {
    expect(
      chatContactSchema.safeParse({
        session,
        name: "Ava",
        email: "ava@example.com",
        phone: "5551234567",
      }).success,
    ).toBe(true);
    expect(
      chatContactSchema.safeParse({ session, name: "Ava", email: "not-email", phone: "5551234567" })
        .success,
    ).toBe(false);
  });
});

describe("offline FAQ fallback", () => {
  it("does not invent a fare or confirm a booking", () => {
    expect(fallbackReply("What is the price?")).toMatch(/do not publish fixed fares/i);
    expect(fallbackReply("Can you confirm my booking?")).toMatch(/confirmed only after/i);
  });

  it("offers human handoff when requested", () => {
    expect(fallbackReply("I need a human agent")).toMatch(/Talk to a person/i);
  });
});
