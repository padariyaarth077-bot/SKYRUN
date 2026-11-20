import { useEffect, useState } from "react";

const slides = [
  "/vehicle-images/cadillac-escalade-esv-2.jpg",
  "/vehicle-images/mercedes-benz-sprinter-executive-van.jpg",
  "/vehicle-images/rolls-royce-ghost.jpg",
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (reduced || hidden) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [reduced, hidden]);
  return (
    <div className="hero-carousel" aria-hidden="true">
      <div
        className="hero-carousel-track"
        style={{ transform: `translate3d(-${index * 100}%,0,0)` }}
      >
        {slides.map((image, i) => (
          <img
            key={image}
            src={image}
            alt=""
            width="1200"
            height="900"
            fetchPriority={i === 0 ? "high" : "low"}
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}
