<script lang="ts">
  /**
   * Place bracket panel: a text input (WAI-ARIA combobox) with a short suggestion list.
   * Free text is always allowed ("Use ..." option or Enter). Escape is handled by the Token.
   */
  import { onMount } from "svelte";
  import QIcon from "./QIcon.svelte";
  import type { PlaceSuggestion } from "./types";

  interface Props {
    id: string;
    label: string;
    value: string;
    suggestions: PlaceSuggestion[];
    placeholder?: string;
    hint?: string;
    maxLength?: number;
    onselect: (value: string) => void;
  }

  let { id, label, value, suggestions, placeholder = "", hint, maxLength = 160, onselect }: Props = $props();

  let input: HTMLInputElement | undefined = $state();
  let query = $state("");
  let active = $state(-1);
  /** True once the visitor chose, confirmed or cancelled (Escape). Otherwise typed text is kept on close. */
  let settled = false;

  const view = $derived.by(() => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const list =
      !q || q === value.trim()
        ? suggestions
        : suggestions.filter((s) => `${s.label} ${s.hint ?? ""}`.toLowerCase().includes(lower));
    const exact = suggestions.some((s) => s.label.toLowerCase() === lower);
    return { list, custom: q && !exact ? q : null };
  });
  const count = $derived(view.list.length + (view.custom ? 1 : 0));
  const optionId = (index: number) => `${id}-opt-${index}`;

  function choose(index: number) {
    settled = true;
    if (index < view.list.length) onselect(view.list[index].label);
    else if (view.custom) onselect(view.custom);
  }

  function onKeydown(event: KeyboardEvent) {
    // Escape cancels (the surrounding Token closes the panel): drop what was typed.
    if (event.key === "Escape") settled = true;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (count === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      active = active < 0 ? (delta === 1 ? 0 : count - 1) : (active + delta + count) % count;
      document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0) return choose(active);
      settled = true;
      if (query.trim()) onselect(query.trim());
      else if (value.trim()) onselect(value.trim());
    }
  }

  onMount(() => {
    query = value;
    input?.focus({ preventScroll: true });
    input?.select();
    // Closed by tapping outside (e.g. straight onto Continue) or tabbing away: keep the typed
    // address instead of silently losing it. An emptied field keeps the previous value.
    return () => {
      if (settled) return;
      const typed = query.trim();
      if (typed && typed !== value.trim()) onselect(typed);
    };
  });
</script>

<div class="p-3 pb-2">
  <label for="{id}-input" class="mb-1.5 block text-sm font-semibold text-fg">{label}</label>
  <input
    bind:this={input}
    bind:value={query}
    id="{id}-input"
    type="text"
    role="combobox"
    aria-expanded={count > 0}
    aria-controls="{id}-list"
    aria-autocomplete="list"
    aria-activedescendant={active >= 0 ? optionId(active) : undefined}
    aria-describedby={hint ? `${id}-hint` : undefined}
    autocomplete="off"
    autocapitalize="words"
    enterkeyhint="done"
    maxlength={maxLength}
    {placeholder}
    class="h-11 w-full rounded-card border border-line-strong bg-bg px-3.5 text-base text-fg transition-colors placeholder:text-muted focus:border-accent"
    oninput={() => (active = -1)}
    onkeydown={onKeydown}
  />
  {#if hint}<p id="{id}-hint" class="mt-1.5 text-xs text-muted">{hint}</p>{/if}
</div>

<div id="{id}-list" role="listbox" aria-label="Suggestions" class="border-t border-line py-1.5">
  {#each view.list as suggestion, i (suggestion.label)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      role="option"
      id={optionId(i)}
      aria-selected={suggestion.label === value}
      data-active={i === active || undefined}
      class="option mx-1.5 flex cursor-pointer items-baseline justify-between gap-3 rounded-[0.75rem] px-3 py-2"
      onclick={() => choose(i)}
      onpointermove={() => (active = i)}
    >
      <span class="flex items-center gap-2 font-semibold text-fg">
        {#if suggestion.label === value}<QIcon name="check" size={14} class="text-accent" />{/if}{suggestion.label}
      </span>
      {#if suggestion.hint}<span class="text-right text-xs text-muted">{suggestion.hint}</span>{/if}
    </div>
  {/each}
  {#if view.custom}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      role="option"
      id={optionId(view.list.length)}
      aria-selected="false"
      data-active={active === view.list.length || undefined}
      class="option mx-1.5 flex cursor-pointer items-center gap-2 rounded-[0.75rem] px-3 py-2 text-fg"
      onclick={() => choose(view.list.length)}
      onpointermove={() => (active = view.list.length)}
    >
      <QIcon name="check" size={14} class="text-accent" />
      <span>Use <strong class="font-semibold">"{view.custom}"</strong></span>
    </div>
  {/if}
</div>

<style>
  .option[data-active] {
    background: var(--surface-2);
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
