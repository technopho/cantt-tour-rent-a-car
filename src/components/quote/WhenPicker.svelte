<script lang="ts">
  /**
   * Date + time bracket panel. Native <input type="date"> and <input type="time"> (the phone's own
   * pickers, no date library), interpreted as Lahore time (PKT, UTC+5), plus quick picks.
   */
  import { onMount } from "svelte";
  import { fromPktInputs, toPktInputs } from "./trip";

  interface Props {
    id: string;
    label: string;
    value: number;
    /** Earliest selectable day (epoch ms). */
    min: number;
    shortcuts: { label: string; value: number }[];
    error?: string;
    onchange: (value: number) => void;
    ondone: () => void;
  }

  let { id, label, value, min, shortcuts, error, onchange, ondone }: Props = $props();

  let dateInput: HTMLInputElement | undefined = $state();
  let timeInput: HTMLInputElement | undefined = $state();
  let date = $state("");
  let time = $state("");
  const minDate = $derived(toPktInputs(min).date);

  function commit() {
    // Read the elements directly so the value never lags behind the binding.
    const ms = fromPktInputs(dateInput?.value ?? date, timeInput?.value ?? time);
    if (ms !== null) onchange(ms);
  }

  function pick(ms: number) {
    const v = toPktInputs(ms);
    date = v.date;
    time = v.time;
    onchange(ms);
  }

  onMount(() => {
    const v = toPktInputs(value);
    date = v.date;
    time = v.time;
    dateInput?.focus({ preventScroll: true });
  });

  const field =
    "h-11 w-full min-w-0 rounded-card border border-line-strong bg-bg px-3 text-base text-fg tabular-nums transition-colors focus:border-accent";
</script>

<div class="p-4">
  <p class="text-sm font-semibold text-fg">{label}</p>
  <div class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
    <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-muted" for="{id}-date">
      Date
      <input bind:this={dateInput} bind:value={date} id="{id}-date" type="date" min={minDate} class={field} oninput={commit} onchange={commit} />
    </label>
    <label class="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-muted" for="{id}-time">
      Time
      <input bind:this={timeInput} bind:value={time} id="{id}-time" type="time" step="900" class={field} oninput={commit} onchange={commit} />
    </label>
  </div>
  <p class="mt-2 text-xs text-muted">Lahore time (PKT).</p>

  {#if shortcuts.length}
    <div class="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick picks">
      {#each shortcuts as s (s.label)}
        <button
          type="button"
          aria-pressed={s.value === value}
          class={[
            "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
            s.value === value ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
          ]}
          onclick={() => pick(s.value)}>{s.label}</button
        >
      {/each}
    </div>
  {/if}

  {#if error}<p class="mt-3 text-sm font-semibold text-accent-fg" role="alert">{error}</p>{/if}

  <div class="mt-4 flex justify-end">
    <button
      type="button"
      class="inline-flex h-10 items-center rounded-full bg-accent-fill px-5 text-sm font-semibold text-accent-ink transition-[background-color,transform] hover:bg-accent-fill-hover active:scale-[0.97]"
      onclick={ondone}>Done</button
    >
  </div>
</div>

<style>
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
