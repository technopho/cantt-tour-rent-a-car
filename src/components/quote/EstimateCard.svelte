<script lang="ts">
  /**
   * Live estimate from catalog rates (src/lib/estimate.ts). Clearly labelled as an estimate; the
   * team confirms the final price. Shows a short hint instead of a number when nothing can be
   * computed (e.g. a with-driver-only car chosen for self drive).
   */
  import { formatPKR } from "@/lib/format";
  import QIcon from "./QIcon.svelte";
  import { SERVICE_PHRASE, plural, type EstimateResult } from "./trip";

  interface Props {
    result: EstimateResult;
    compact?: boolean;
  }

  let { result, compact = false }: Props = $props();

  const summary = $derived.by(() => {
    if (!result.ok) return "";
    const { estimate, model, any } = result;
    const car = any ? `our most affordable suitable car, the ${model.name}` : `the ${model.name}`;
    return `${plural(estimate.days, "day")} with ${car}, ${SERVICE_PHRASE[estimate.serviceType]}`;
  });

  /** Disclaimer last and emphasised; the other notes (fuel, tolls, deposit) above it. */
  const notes = $derived(result.ok ? result.estimate.notes : []);
  const live = $derived(result.ok ? `Estimated from ${formatPKR(result.estimate.total)} for ${plural(result.estimate.days, "day")}.` : result.message);
</script>

<div class="flex h-full flex-col">
  <p class="flex items-center gap-2 text-sm font-semibold text-fg">
    <span class="relative flex size-2" aria-hidden="true">
      <span class="pulse absolute inline-flex size-full rounded-full bg-accent opacity-60"></span>
      <span class="relative inline-flex size-2 rounded-full bg-accent"></span>
    </span>
    Live estimate
  </p>

  {#if result.ok}
    <p class="mt-4 text-sm text-muted">Estimated from</p>
    {#key result.estimate.total}
      <p class="tick font-display text-[clamp(2rem,1.5rem+2.2cqi,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-fg tabular-nums">
        <data value={result.estimate.total}>{formatPKR(result.estimate.total)}</data>
      </p>
    {/key}
    <p class="mt-2 text-sm text-muted">{summary}.</p>

    {#if !compact && result.estimate.lines.length}
      <dl class="mt-5 divide-y divide-line border-y border-line text-sm">
        {#each result.estimate.lines as line (line.label)}
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="min-w-0">
              <span class="text-fg">{line.label}</span>
              <span class="block text-xs text-muted tabular-nums">{plural(line.quantity, line.unit)} &times; {formatPKR(line.rate)}</span>
            </dt>
            <dd class="shrink-0 font-semibold text-fg tabular-nums">{formatPKR(line.amount)}</dd>
          </div>
        {/each}
      </dl>
    {/if}

    <ul class="mt-4 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
      {#each notes as note, i (i)}
        {@const last = i === notes.length - 1}
        {#if !compact || last}
          <li class={["flex gap-2", last && "font-semibold text-fg"]}>
            {#if last}
              <QIcon name="info" size={14} class="mt-0.5 text-accent" />
            {:else}
              <span class="mt-[0.6em] size-1 shrink-0 rounded-full bg-muted" aria-hidden="true"></span>
            {/if}
            <span>{note}</span>
          </li>
        {/if}
      {/each}
    </ul>
  {:else}
    <p class="mt-4 text-sm text-muted">{result.message}</p>
    <p class="mt-3 text-xs text-muted">
      Estimates use the daily rates on our <a href="/rates/" class="font-semibold text-fg underline underline-offset-2 hover:text-accent-fg">rates page</a>. Our team confirms
      the final price on WhatsApp.
    </p>
  {/if}

  <p class="sr-only" aria-live="polite" aria-atomic="true">{live}</p>
</div>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .tick {
      animation: tick-in 0.4s var(--ease-out) both;
    }
    .pulse {
      animation: pulse 2.4s var(--ease-out) infinite;
    }
  }
  @keyframes tick-in {
    from {
      opacity: 0.25;
      transform: translateY(0.18em);
    }
  }
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.6;
    }
    80%,
    100% {
      transform: scale(2.6);
      opacity: 0;
    }
  }
</style>
