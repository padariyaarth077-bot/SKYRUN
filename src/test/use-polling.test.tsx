import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePolling } from "@/lib/use-polling";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("does not overlap slow requests or keep scheduling after disabled", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  let finish!: () => void;
  const callback = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender, unmount } = renderHook(({ enabled }) => usePolling(callback, enabled), {
    initialProps: { enabled: true },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(callback).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(callback).toHaveBeenCalledTimes(2);
  rerender({ enabled: false });
  await act(async () => {
    finish();
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(callback).toHaveBeenCalledTimes(2);
  unmount();
});
