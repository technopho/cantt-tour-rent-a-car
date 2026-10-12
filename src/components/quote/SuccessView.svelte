<script lang="ts">
  /** Success screen: reference number, what happens next, "WhatsApp us" (prefilled with the ref) and "Call now". */
  import { onMount } from "svelte";
  import QIcon from "./QIcon.svelte";

  interface Props {
    uid: string;
    reference: string;
    /** Visitor's number as they will see it on WhatsApp ("0300 1234567"), or "". */
    customerPhone: string;
    whatsappHref: string;
    telHref: string;
    hours: string[];
    onrestart: () => void;
  }

  let { uid, reference, customerPhone, whatsappHref, telHref, hours, onrestart }: Props = $props();

  let root: HTMLDivElement | undefined = $state();
  let title: HTMLParagraphElement | undefined = $state();
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      copied = true;
      setTimeout(() => (copied = false), 2200);
    } catch {
      /* clipboard blocked: the reference stays visible */
    }
  }

  onMount(() => {
    title?.focus({ preventScroll: true });
    // Step 2 is taller than this screen: bring the whole confirmation (badge included) into view,
    // below the fixed header (html scroll-padding-top).
    const top = root?.getBoundingClientRect().top ?? 0;
    if (top < 80 || top > window.innerHeight * 0.6) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    }
  });

  const steps = $derived([
    "We check which cars are free for your dates.",
    customerPhone ? `We WhatsApp the final price to ${customerPhone}.` : "We WhatsApp you the final price.",
    "Nothing is booked until you confirm.",
  ]);
</script>

<div bind:this={root} class="relative grid gap-10 p-6 @md:p-10 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:gap-14">
  <div>
    <span class="done-badge grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
      <QIcon name="checkCircle" size={30} />
    </span>
    <p bind:this={title} id="{uid}-done-title" tabindex="-1" class="mt-6 font-display text-display-md text-fg outline-none">Request received</p>
    <p class="mt-4 text-sm text-muted">Your reference</p>
    <div class="mt-1 flex flex-wrap items-center gap-3">
      <span class="font-display text-display-sm tracking-[-0.02em] text-fg tabular-nums">{reference}</span>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
        onclick={copy}
      >
        <QIcon name={copied ? "check" : "copy"} size={14} />{copied ? "Copied" : "Copy"}
      </button>
      <span class="sr-only" aria-live="polite">{copied ? "Reference copied" : ""}</span>
    </div>
    <p class="mt-4 max-w-md text-sm text-muted">Mention it on WhatsApp or the phone and we will find your request straight away.</p>

    <div class="mt-7 flex flex-wrap gap-3">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-12 items-center gap-2.5 rounded-full border border-line bg-surface-2 px-6 font-semibold text-fg transition-colors hover:border-line-strong"
      >
        <QIcon name="whatsapp" size={20} class="text-whatsapp" />WhatsApp us
      </a>
      <a href={telHref} class="inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-fg transition-colors hover:bg-surface-2">
        <QIcon name="phone" size={18} />Call now
      </a>
    </div>
  </div>

  <div class="border-t border-line pt-8 @4xl:border-t-0 @4xl:border-l @4xl:pt-0 @4xl:pl-10">
    <p class="text-sm font-semibold text-fg">What happens next</p>
    <ol class="mt-5 flex flex-col gap-4">
      {#each steps as step, i (i)}
        <li class="flex items-start gap-4">
          <span class="grid size-8 shrink-0 place-items-center rounded-full border border-line font-display text-sm text-accent-fg tabular-nums">{i + 1}</span>
          <span class="pt-1 text-fg">{step}</span>
        </li>
      {/each}
    </ol>
    {#if hours.length}
      <p class="mt-6 text-sm text-muted">We reply during opening hours: {hours.join("; ")}.</p>
    {/if}
    <button type="button" class="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-fg underline-offset-4 hover:underline" onclick={onrestart}>
      Plan another trip<QIcon name="arrowRight" size={14} />
    </button>
  </div>
</div>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .done-badge {
      animation: done-pop 0.5s var(--ease-spring) both;
    }
  }
  @keyframes done-pop {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
</style>
