<script lang="ts">
  /**
   * Single-select listbox for a sentence bracket (WAI-ARIA listbox, aria-activedescendant).
   * Focus moves onto the list when it opens. Keys: Up/Down, Home/End, Enter/Space to choose,
   * type a letter to jump. Escape is handled by the surrounding Token. Options can be grouped.
   */
  import { onMount, tick } from "svelte";
  import QIcon from "./QIcon.svelte";
  import type { ListOption } from "./types";

  interface Props {
    id: string;
    label: string;
    options: ListOption[];
    value: string;
    onselect: (value: string) => void;
  }

  let { id, label, options, value, onselect }: Props = $props();

  let list: HTMLDivElement | undefined = $state();
  let active = $state(0);

  const groups = $derived.by(() => {
    const out: { name: string | undefined; items: { option: ListOption; index: number }[] }[] = [];
    options.forEach((option, index) => {
      const last = out[out.length - 1];
      if (last && last.name === option.group) last.items.push({ option, index });
      else out.push({ name: option.group, items: [{ option, index }] });
    });
    return out;
  });

  const optionId = (index: number) => `${id}-opt-${index}`;

  function scrollActive() {
    tick().then(() => document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" }));
  }

  function move(delta: 1 | -1, from = active) {
    for (let i = from + delta; i >= 0 && i < options.length; i += delta) {
      if (!options[i].disabled) {
        active = i;
        scrollActive();
        return;
      }
    }
  }

  function choose(index: number) {
    const option = options[index];
    if (option && !option.disabled) onselect(option.value);
  }

  function typeahead(key: string) {
    const k = key.toLowerCase();
    for (let n = 1; n <= options.length; n++) {
      const i = (active + n) % options.length;
      if (!options[i].disabled && options[i].label.toLowerCase().startsWith(k)) {
        active = i;
        scrollActive();
        return;
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        move(1, -1);
        break;
      case "End":
        event.preventDefault();
        move(-1, options.length);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key);
    }
  }

  onMount(() => {
    const selected = options.findIndex((o) => o.value === value && !o.disabled);
    active = selected >= 0 ? selected : Math.max(0, options.findIndex((o) => !o.disabled));
    list?.focus({ preventScroll: true });
    scrollActive();
  });
</script>

{#snippet item(option: ListOption, index: number)}
  {@const selected = option.value === value}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    role="option"
    id={optionId(index)}
    aria-selected={selected}
    aria-disabled={option.disabled || undefined}
    data-active={index === active || undefined}
    class={[
      "option mx-1.5 flex cursor-pointer items-start gap-3 rounded-[0.75rem] px-3 py-2.5",
      option.disabled && "cursor-not-allowed opacity-55",
    ]}
    onclick={() => choose(index)}
    onpointermove={() => {
      if (!option.disabled) active = index;
    }}
  >
    <span class={["mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", selected ? "bg-accent-fill text-accent-ink" : "border border-line-strong/60"]}>
      {#if selected}<QIcon name="check" size={12} />{/if}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block font-semibold text-fg">{option.label}</span>
      {#if option.hint}<span class="block text-sm text-muted">{option.hint}</span>{/if}
    </span>
    {#if option.meta}<span class="shrink-0 pt-0.5 text-sm whitespace-nowrap text-muted tabular-nums">{option.meta}</span>{/if}
  </div>
{/snippet}

<div
  bind:this={list}
  id="{id}-list"
  role="listbox"
  tabindex="0"
  aria-label={label}
  aria-activedescendant={optionId(active)}
  class="listbox py-1.5 outline-none"
  onkeydown={onKeydown}
>
  {#each groups as group, g (g)}
    {#if group.name}
      <div role="group" aria-labelledby="{id}-group-{g}" class="mt-1 border-t border-line pt-1 first:mt-0 first:border-t-0 first:pt-0">
        <div role="presentation" id="{id}-group-{g}" class="px-4.5 pt-2.5 pb-1 text-xs font-bold tracking-[0.14em] text-muted uppercase">{group.name}</div>
        {#each group.items as { option, index } (option.value)}
          {@render item(option, index)}
        {/each}
      </div>
    {:else}
      {#each group.items as { option, index } (option.value)}
        {@render item(option, index)}
      {/each}
    {/if}
  {/each}
</div>

<style>
  .option[data-active] {
    background: var(--surface-2);
  }
  .listbox:focus-visible .option[data-active] {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
</style>
