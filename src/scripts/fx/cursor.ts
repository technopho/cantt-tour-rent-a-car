/**
 * Custom cursor for fine pointers: a brass dot that follows exactly and a ring that trails behind it.
 * Over links and buttons the ring grows; over [data-cursor="View"] it fills with brass and shows the
 * label. The native cursor is only hidden (html.has-cursor) after the first real pointer move, and comes
 * back while a modal dialog is open, because a dialog's top layer would sit above the custom one.
 */
type Gsap = typeof import("gsap").gsap;

const INTERACTIVE = "a, button, summary, label, select, [role='button'], [data-cursor]";
const NATIVE = "input, textarea, [contenteditable='true'], iframe";

export function startCursor(gsap: Gsap): void {
  const dot = document.createElement("div");
  const ring = document.createElement("div");
  const label = document.createElement("span");
  dot.className = "fx-cursor-dot fx-cursor-hide";
  ring.className = "fx-cursor-ring fx-cursor-hide";
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  ring.append(label);
  document.body.append(ring, dot);

  const dotX = gsap.quickSetter(dot, "x", "px");
  const dotY = gsap.quickSetter(dot, "y", "px");
  const ringX = gsap.quickTo(ring, "x", { duration: 0.55, ease: "power3.out" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.55, ease: "power3.out" });

  let live = false;

  const show = (visible: boolean) => {
    dot.classList.toggle("fx-cursor-hide", !visible);
    ring.classList.toggle("fx-cursor-hide", !visible);
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      if (!live) {
        live = true;
        document.documentElement.classList.add("has-cursor");
        gsap.set(ring, { x: event.clientX, y: event.clientY });
        show(true);
      }
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);
    },
    { passive: true },
  );

  document.addEventListener("pointerover", (event) => {
    const target = event.target as Element | null;
    if (!target?.closest) return;
    if (target.closest(NATIVE)) {
      show(false);
      return;
    }
    if (live) show(true);
    const labelled = target.closest<HTMLElement>("[data-cursor]");
    if (labelled?.dataset.cursor) {
      label.textContent = labelled.dataset.cursor;
      ring.dataset.state = "label";
    } else if (target.closest(INTERACTIVE)) {
      ring.dataset.state = "link";
    } else {
      delete ring.dataset.state;
    }
  });

  document.documentElement.addEventListener("pointerleave", () => show(false));
  document.documentElement.addEventListener("pointerenter", () => live && show(true));
}
