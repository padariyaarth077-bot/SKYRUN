import { describe, expect, it } from "vitest";
import {
  CHAT_MAX_MESSAGE_LENGTH,
  chatContactSchema,
  chatMessageSchema,
  fallbackReply,
  chatPageHasGap,
  mergeChatMessages,
} from "@/lib/chat.shared";

const session = "A".repeat(43);

it("retains distinct messages and exposes an offline gap instead of silently skipping history", () => {
  const first = {
    id: "first",
    sender_type: "CUSTOMER" as const,
    message: "First",
    created_at: "2026-10-21T10:00:00Z",
  };
  const latest = { ...first, id: "latest", message: "Latest", created_at: "2026-10-21T12:00:00Z" };
  expect(chatPageHasGap([first], [latest], true)).toBe(true);
  expect(chatPageHasGap([first], [first, latest], true)).toBe(false);
  expect(chatPageHasGap([], [latest], true)).toBe(false);
  expect(mergeChatMessages([latest, first], [latest]).map((message) => message.id)).toEqual([
    "first",
    "latest",
  ]);
});

describe("chat input boundaries", () => {
  it("accepts a bounded visitor message and rejects an oversized one", () => {
    expect(
      chatMessageSchema.safeParse({
        session,
        operationId: "11111111-1111-4111-8111-111111111111",
        message: "Airport pickup",
      }).success,
    ).toBe(true);
    expect(
      chatMessageSchema.safeParse({
        session,
        operationId: "11111111-1111-4111-8111-111111111111",
        message: "x".repeat(CHAT_MAX_MESSAGE_LENGTH + 1),
      }).success,
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
