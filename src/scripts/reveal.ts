/**
 * Scroll reveal fallback. Browsers with CSS scroll-driven animations (animation-timeline: view())
 * need no JS at all; elsewhere this adds .is-revealed to [data-reveal] elements as they enter.
 * Called once per page by the BaseLayout bootstrap. Safe to call again (e.g. after inserting
 * new [data-reveal] content).
 */
let observer: IntersectionObserver | null = null;

export function initReveals(root: ParentNode = document): void {
  const supportsScrollTimeline = typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = root.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)");
  if (items.length === 0) return;

  if (supportsScrollTimeline) return;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  items.forEach((el) => observer?.observe(el));
}
