<script lang="ts">
  /**
   * One bracket of the trip sentence: a pill button that opens a floating panel right under it.
   * The parent owns which bracket is open (only one at a time) and renders the panel content.
   *
   * Accessibility: aria-haspopup/aria-expanded/aria-controls on the button, Escape closes and
   * returns focus, clicking outside or tabbing away closes without stealing focus, focus goes back
   * to the button after a choice is made inside the panel. The panel stays inside the sentence
   * box (shifted left when the bracket sits near the right edge) so it never overflows at 320px.
   */
  import { tick, untrack, type Snippet } from "svelte";
  import QIcon from "./QIcon.svelte";

  interface Props {
    id: string;
    /** Visible text inside the bracket. */
    text: string;
    /** Screen-reader prefix, e.g. "Car" (read as "Car: Toyota Corolla"). */
    name: string;
    open: boolean;
    popup?: "listbox" | "dialog";
    /** Nothing chosen yet: dashed accent bracket. */
    empty?: boolean;
    /** Error message id is `${id}-error` (rendered by the parent). */
    invalid?: boolean;
    /** Preferred panel width in px (capped to the sentence width). */
    panelWidth?: number;
    onopenchange: (open: boolean) => void;
    children: Snippet;
  }

  let { id, text, name, open, popup = "listbox", empty = false, invalid = false, panelWidth = 352, onopenchange, children }: Props = $props();

  let wrap: HTMLSpanElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let panel: HTMLSpanElement | undefined = $state();
  let shift = $state(0);
  let width = $state<number | null>(null);
  /** Return focus to the button when the panel closes (false when the user clicked or tabbed elsewhere). */
  let refocus = true;

  function place() {
    if (!wrap) return;
    const boundary = wrap.closest<HTMLElement>("[data-composer-sentence]") ?? wrap.parentElement;
    if (!boundary) return;
    const box = boundary.getBoundingClientRect();
    const token = wrap.getBoundingClientRect();
    const w = Math.min(panelWidth, box.width);
    const tokenLeft = token.left - box.left;
    const left = Math.max(0, Math.min(tokenLeft, box.width - w));
    width = w;
    shift = left - tokenLeft;
  }

  function close(focusButton: boolean) {
    refocus = focusButton;
    onopenchange(false);
  }

  function setup() {
    refocus = true;
    place();
    const onPointerDown = (event: PointerEvent) => {
      if (wrap && !wrap.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", place);
    // Phones: bring the panel fully into view if it opened below the fold.
    tick().then(() => {
      const rect = panel?.getBoundingClientRect();
      if (rect && rect.bottom > window.innerHeight) panel?.scrollIntoView({ block: "nearest" });
    });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", place);
      if (!refocus) return;
      const active = document.activeElement;
      if (!active || active === document.body || wrap?.contains(active)) button?.focus();
    };
  }

  $effect(() => {
    if (!open) return;
    return untrack(setup);
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }

  function onFocusOut(event: FocusEvent) {
    // relatedTarget is null when focus goes nowhere (e.g. Safari button clicks): the pointerdown
    // handler covers outside clicks, so only close when focus really moved to another element.
    const next = event.relatedTarget as Node | null;
    if (open && next && wrap && !wrap.contains(next)) close(false);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span bind:this={wrap} class="token-wrap relative inline-block max-w-full align-baseline" onkeydown={onKeydown} onfocusout={onFocusOut}>
  <button
    bind:this={button}
    type="button"
    id="{id}-button"
    class="token"
    aria-haspopup={popup}
    aria-expanded={open}
    aria-controls={open ? (popup === "listbox" ? `${id}-list` : `${id}-panel`) : undefined}
    aria-describedby={invalid ? `${id}-error` : undefined}
    data-open={open || undefined}
    data-empty={empty || undefined}
    data-invalid={invalid || undefined}
    onclick={() => onopenchange(!open)}
  >
    <span class="sr-only">{`${name}: `}</span><span class="token-text">{text}</span>
    {#if invalid}<QIcon name="warning" size="0.7em" class="text-accent-fg" />{/if}
    <QIcon name="caretDown" size="0.6em" class="token-caret" />
  </button>
  {#if open}
    <span
      bind:this={panel}
      id="{id}-panel"
      role={popup === "dialog" ? "dialog" : undefined}
      aria-label={popup === "dialog" ? name : undefined}
      class="token-panel absolute top-[calc(100%+0.5rem)] left-0 z-40 block max-h-[min(26rem,64dvh)] overflow-y-auto overscroll-contain rounded-card border border-line bg-surface text-left font-sans text-base leading-normal font-normal tracking-normal text-fg shadow-lift"
      style:width={width ? `${width}px` : "min(22rem, calc(100vw - 2rem))"}
      style:translate="{shift}px 0"
      data-lenis-prevent
    >
      {@render children()}
    </span>
  {/if}
</span>

<style>
  .token {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: 0.32em;
    margin-block: 0.08em;
    padding: 0.04em 0.55em 0.08em 0.62em;
    border: 1px solid color-mix(in oklab, var(--text) 22%, transparent);
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    line-height: 1.35;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.2s var(--ease-out),
      background-color 0.2s var(--ease-out),
      color 0.2s var(--ease-out);
  }
  .token-text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .token:hover {
    border-color: var(--accent);
  }
  .token[data-open] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .token[data-empty] {
    border-style: dashed;
    border-color: color-mix(in oklab, var(--accent) 70%, transparent);
    background: transparent;
    color: var(--accent-fg);
  }
  .token[data-invalid] {
    border-style: solid;
    border-color: var(--accent-fg);
    box-shadow: 0 0 0 1px var(--accent-fg);
  }
  .token :global(.token-caret) {
    opacity: 0.65;
    transition: transform 0.25s var(--ease-out);
  }
  .token[data-open] :global(.token-caret) {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: no-preference) {
    .token-panel {
      animation: token-pop 0.22s var(--ease-out) both;
    }
  }
  @keyframes token-pop {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.985);
    }
  }
</style>
