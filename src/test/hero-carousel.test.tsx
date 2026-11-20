import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeroCarousel } from "@/components/hero-carousel";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(reduced = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.useFakeTimers();
  return render(<HeroCarousel />);
}
it("advances automatically without manual carousel controls", () => {
  const { container } = setup();
  act(() => vi.advanceTimersByTime(6500));
  expect(container.querySelector(".hero-carousel-track")?.getAttribute("style")).toContain("-100%");
  expect(container.querySelectorAll("button")).toHaveLength(0);
  act(() => vi.advanceTimersByTime(13000));
  expect(container.querySelector(".hero-carousel-track")?.getAttribute("style")).toContain("-0%");
});
it("does not autoplay for reduced motion", () => {
  const { container } = setup(true);
  act(() => vi.advanceTimersByTime(13000));
  expect(container.querySelector(".hero-carousel-track")?.getAttribute("style")).toContain("-0%");
  expect(container.querySelectorAll("button")).toHaveLength(0);
});
