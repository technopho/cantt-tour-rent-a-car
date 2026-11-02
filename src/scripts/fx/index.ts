/**
 * Site-wide motion layer. Loaded once on idle by src/scripts/bootstrap.ts: pages and components use the
 * attributes below and write no JS of their own. Combine several with spaces: data-fx="fade magnetic".
 *
 * Reveals (play once when the element enters; wait for the preloader's doors to open)
 *   data-fx="lines"     Text splits into masked lines that rise in. Put it on the block holding the text.
 *                       Accessible text is kept, and the split is undone when the animation ends.
 *   data-fx="words"     The same, word by word. For short lines.
 *   data-fx="image"     Clip-path wipe upward on a frame, with its inner <img> scaling 1.2 to 1.
 *   data-fx="rule"      A hairline draws itself from the left. Put it on the 1px element.
 *   data-fx="fade"      Fade with a small rise.
 *   data-fx="stagger"   Direct children rise in one after another. data-stagger="0.09" sets the gap.
 *   data-fx="counter"   Counts up to the number already in the text: <span data-fx="counter">1,250</span>.
 *                       Prefix and suffix are kept. data-to="1250" overrides. Only for real numbers.
 *   data-fx="wordmark"  Oversized word whose letters rise with the scroll (the footer's "Cantt").
 *   Options for every reveal: data-delay="0.2" (seconds), data-start="top 80%" (ScrollTrigger start).
 *
 * Continuous
 *   data-fx="parallax"  Moves against the scroll, scrubbed. data-speed="0.15" (default; negative reverses)
 *                       is the share of its own height it travels. An <img> is scaled to cover the travel,
 *                       so put it inside an overflow-hidden frame.
 *   data-fx="kenburns"  Very slow push-in on an <img>. CSS only, paused off screen. Use overflow-hidden.
 *   data-fx="marquee"   Children loop horizontally and speed up with the scroll. data-speed="60" (px/s),
 *                       data-direction="right". Clones are aria-hidden.
 *
 * Pointer (fine pointers only)
 *   data-fx="magnetic"  Leans toward the pointer. data-strength="0.3". On every Button by default.
 *   data-cursor="View"  The custom cursor's ring grows and shows the label over this element. Any link or
 *                       button already grows the ring a little. No data-fx needed.
 *
 * Page transitions: same-site links get the obsidian curtain automatically. data-no-transition opts one out.
 *
 * Fallbacks: text and images are only hidden while html.js is set and html.fx-off is not. The preloader
 * script sets html.fx-off if this module has not reported in (html.fx-ready) shortly after it ends, and the
 * bootstrap sets it if the module fails to load. Under prefers-reduced-motion nothing is hidden or moved.
 *
 * Content added later (an island, a filter): call refreshFx(container).
 */
import { hasFinePointer, prefersReducedMotion, whenPreloaderParts, afterPreloader } from "../capabilities";
import { loadGsap } from "../motion";
import { startTransitions } from "./transitions";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;
type SplitTextType = typeof import("gsap/SplitText").SplitText;

interface Kit {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerType;
  SplitText: SplitTextType;
}

const html = document.documentElement;
const ON = "data-fx-on";
const EASE = "expo.out";

let kit: Kit | null = null;
let kenburnsIo: IntersectionObserver | null = null;

const has = (el: Element, name: string) => (el.getAttribute("data-fx") ?? "").split(/\s+/).includes(name);
const num = (value: string | undefined, fallback: number) => {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : fallback;
};

/** The module arrived after the fallback fired: whatever is already on screen stays as it is. */
function tooLate(el: Element): boolean {
  return html.classList.contains("fx-off") && el.getBoundingClientRect().top < window.innerHeight;
}

function trigger(el: HTMLElement) {
  return { trigger: el, start: el.dataset.start || "top 88%", once: true };
}

/* ------------------------------------------------------------------------------------------ */
/* Reveals                                                                                      */
/* ------------------------------------------------------------------------------------------ */

function splitReveal(el: HTMLElement, type: "lines" | "words", { gsap, SplitText }: Kit) {
  if (tooLate(el)) return;
  const hasControls = el.querySelector("a, button") !== null;
  const split = SplitText.create(el, {
    type,
    mask: type,
    linesClass: "fx-line",
    wordsClass: "fx-word",
    aria: hasControls ? "none" : "auto",
  });
  const parts = type === "lines" ? split.lines : split.words;
  gsap.fromTo(
    parts,
    { yPercent: 130 },
    {
      yPercent: 0,
      duration: type === "lines" ? 1.4 : 1.15,
      ease: EASE,
      stagger: type === "lines" ? 0.11 : 0.045,
      delay: num(el.dataset.delay, 0),
      scrollTrigger: trigger(el),
      onComplete: () => split.revert(),
    },
  );
}

function imageReveal(el: HTMLElement, { gsap }: Kit) {
  if (tooLate(el)) return;
  const delay = num(el.dataset.delay, 0);
  gsap.fromTo(
    el,
    { clipPath: "inset(100% 0% 0% 0%)" },
    { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut", delay, scrollTrigger: trigger(el), clearProps: "clipPath" },
  );
  const inner = el.querySelector("img, video, picture");
  if (inner && !has(inner, "kenburns") && !has(inner, "parallax")) {
    gsap.fromTo(inner, { scale: 1.2 }, { scale: 1, duration: 2.2, ease: EASE, delay: delay + 0.15, scrollTrigger: trigger(el), clearProps: "transform" });
  }
}

function ruleReveal(el: HTMLElement, { gsap }: Kit) {
  if (tooLate(el)) return;
  gsap.fromTo(
    el,
    { scaleX: 0 },
    { scaleX: 1, transformOrigin: "0 50%", duration: 1.7, ease: "expo.inOut", delay: num(el.dataset.delay, 0), scrollTrigger: trigger(el), clearProps: "transform" },
  );
}

function fadeReveal(el: HTMLElement, { gsap }: Kit) {
  if (tooLate(el)) return;
  gsap.fromTo(
    el,
    { opacity: 0, y: 18 },
    { opacity: 1, y: 0, duration: 1.5, ease: EASE, delay: num(el.dataset.delay, 0), scrollTrigger: trigger(el), clearProps: "opacity,transform" },
  );
}

function staggerReveal(el: HTMLElement, { gsap }: Kit) {
  if (tooLate(el)) return;
  const children = [...el.children];
  if (children.length === 0) return;
  gsap.fromTo(
    children,
    { opacity: 0, y: 36 },
    {
      opacity: 1,
      y: 0,
      duration: 1.3,
      ease: EASE,
      stagger: num(el.dataset.stagger, 0.09),
      delay: num(el.dataset.delay, 0),
      scrollTrigger: trigger(el),
      clearProps: "opacity,transform",
    },
  );
}

function counterReveal(el: HTMLElement, { gsap }: Kit) {
  const match = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(el.textContent ?? "");
  const to = el.dataset.to ? num(el.dataset.to, 0) : match ? Number.parseFloat(match[2].replaceAll(",", "")) : Number.NaN;
  if (!Number.isFinite(to)) return;
  const original = el.textContent ?? "";
  const prefix = match?.[1] ?? "";
  const suffix = match?.[3] ?? "";
  const decimals = match?.[2].split(".")[1]?.length ?? 0;
  const format = (v: number) => `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const state = { v: 0 };
  el.textContent = format(0);
  el.setAttribute("aria-label", original.trim());
  gsap.to(state, {
    v: to,
    duration: 2.2,
    ease: "power4.out",
    delay: num(el.dataset.delay, 0),
    scrollTrigger: trigger(el),
    onUpdate: () => {
      el.textContent = format(state.v);
    },
    onComplete: () => {
      el.textContent = original;
      el.removeAttribute("aria-label");
    },
  });
}

function wordmarkReveal(el: HTMLElement, { gsap, SplitText }: Kit) {
  const split = SplitText.create(el, { type: "chars", mask: "chars", charsClass: "fx-char", aria: "none" });
  gsap.fromTo(
    split.chars,
    { yPercent: 112 },
    {
      yPercent: 0,
      ease: "none",
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: el.dataset.start || "top bottom", end: "max", scrub: 1 },
    },
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Continuous                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function parallax(el: HTMLElement, { gsap }: Kit) {
  const speed = num(el.dataset.speed, 0.15);
  const travel = speed * 50;
  if (el instanceof HTMLImageElement) gsap.set(el, { scale: 1 + Math.abs(speed) });
  gsap.fromTo(
    el,
    { yPercent: -travel },
    {
      yPercent: travel,
      ease: "none",
      scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true },
    },
  );
}

function kenburns(el: HTMLElement) {
  kenburnsIo ??= new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle("fx-paused", !entry.isIntersecting);
  });
  kenburnsIo.observe(el);
}

function marquee(el: HTMLElement, { gsap }: Kit) {
  const track = document.createElement("div");
  track.className = "fx-marquee-track";
  track.append(...el.childNodes);
  el.append(track);

  const original = [...track.children];
  if (original.length === 0) return;
  // Enough copies to cover the frame twice, then the loop point is one full set.
  const setWidth = track.scrollWidth;
  if (setWidth === 0) return;
  const copies = Math.ceil((el.clientWidth * 2) / setWidth);
  for (let i = 0; i < copies; i++) {
    for (const child of original) {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a, button").forEach((c) => c.setAttribute("tabindex", "-1"));
      track.append(clone);
    }
  }

  const direction = el.dataset.direction === "right" ? 1 : -1;
  const speed = num(el.dataset.speed, 60);
  let x = 0;
  let boost = 0;
  let lastScroll = window.scrollY;
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(el);

  gsap.ticker.add((_time, delta) => {
    const dt = Math.min(64, delta) / 1000;
    const scroll = window.scrollY;
    boost += (Math.min(6, Math.abs(scroll - lastScroll) * 0.12) - boost) * 0.08;
    lastScroll = scroll;
    if (!visible) return;
    x += direction * speed * (1 + boost) * dt;
    if (x <= -setWidth) x += setWidth;
    if (x > 0) x -= setWidth;
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Pointer                                                                                      */
/* ------------------------------------------------------------------------------------------ */

function magnetic(el: HTMLElement, { gsap }: Kit) {
  const strength = num(el.dataset.strength, 0.3);
  let box: DOMRect | null = null;
  const x = gsap.quickTo(el, "x", { duration: 0.9, ease: "power4.out" });
  const y = gsap.quickTo(el, "y", { duration: 0.9, ease: "power4.out" });
  el.addEventListener("pointerenter", () => {
    box = el.getBoundingClientRect();
  });
  el.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    box ??= el.getBoundingClientRect();
    x((event.clientX - box.left - box.width / 2) * strength);
    y((event.clientY - box.top - box.height / 2) * strength);
  });
  el.addEventListener("pointerleave", () => {
    box = null;
    x(0);
    y(0);
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Wiring                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function takeOver(el: HTMLElement, k: Kit) {
  if (el.hasAttribute(ON)) return;
  // First, so the hidden CSS state lets go before GSAP reads anything. Tweens set their own start state.
  el.setAttribute(ON, "");
  const run = (name: string, fn: () => void) => {
    if (!has(el, name)) return;
    try {
      fn();
    } catch (error) {
      console.warn(`[fx] ${name} failed`, error);
    }
  };
  run("lines", () => splitReveal(el, "lines", k));
  run("words", () => splitReveal(el, "words", k));
  run("image", () => imageReveal(el, k));
  run("rule", () => ruleReveal(el, k));
  run("fade", () => fadeReveal(el, k));
  run("stagger", () => staggerReveal(el, k));
  run("counter", () => counterReveal(el, k));
  run("wordmark", () => wordmarkReveal(el, k));
  run("parallax", () => parallax(el, k));
  run("kenburns", () => kenburns(el));
  run("marquee", () => marquee(el, k));
  if (hasFinePointer()) run("magnetic", () => magnetic(el, k));
}

function reveal(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-fx]").forEach((el) => {
    if (prefersReducedMotion()) el.setAttribute(ON, "");
    else if (kit) takeOver(el, kit);
  });
}

/** Wire up data-fx elements inserted after the first pass. */
export function refreshFx(root: ParentNode = document): void {
  reveal(root);
  kit?.ScrollTrigger.refresh();
}

let started = false;

export async function startFx(): Promise<void> {
  if (started) return;
  started = true;

  startTransitions();

  if (prefersReducedMotion()) {
    reveal(document);
    html.classList.add("fx-ready");
    return;
  }

  const [{ gsap, ScrollTrigger }, { SplitText }] = await Promise.all([loadGsap(), import("gsap/SplitText")]);
  gsap.registerPlugin(SplitText);
  kit = { gsap, ScrollTrigger, SplitText };

  // Line breaks are only right once the real fonts are in. Do not wait long for them.
  await Promise.race([document.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 1200))]);

  whenPreloaderParts(() => {
    reveal(document);
    html.classList.add("fx-ready");
    afterPreloader(() => ScrollTrigger.refresh());
  });

  if (hasFinePointer()) {
    import("./cursor").then((m) => m.startCursor(gsap)).catch(() => {});
  }
}
