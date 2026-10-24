import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  closeNotificationAudio,
  playNotificationSound,
  unlockNotificationAudio,
} from "@/lib/notification-sound";
const start = vi.fn(),
  resume = vi.fn(),
  stop = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = resume;
      close = () => Promise.resolve();
      createOscillator() {
        return {
          frequency: { value: 0 },
          type: "sine",
          connect: vi.fn(),
          start,
          stop,
          disconnect: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
    },
  );
});
afterEach(() => {
  closeNotificationAudio();
  vi.unstubAllGlobals();
});
it("never initializes audio from a background notification", () => {
  expect(playNotificationSound("NORMAL", 0.5)).toBe(false);
  expect(resume).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});
it("plays short distinct tones only after explicit unlock and respects zero volume", async () => {
  expect(await unlockNotificationAudio()).toBe(true);
  expect(playNotificationSound("NORMAL", 0)).toBe(false);
  expect(playNotificationSound("NORMAL", 0.5)).toBe(true);
  expect(start).toHaveBeenCalledTimes(2);
  expect(playNotificationSound("URGENT", 0.5)).toBe(true);
  expect(start).toHaveBeenCalledTimes(5);
  expect(stop).toHaveBeenCalledTimes(5);
});
it("audio rejection fails harmlessly", async () => {
  resume.mockRejectedValue(new Error("blocked"));
  expect(await unlockNotificationAudio()).toBe(false);
  expect(playNotificationSound("URGENT", 0.5)).toBe(false);
});
