<script lang="ts">
  /** Label + control + hint + error, with aria-describedby wiring handed to the control snippet. */
  import type { Snippet } from "svelte";
  import QIcon from "./QIcon.svelte";

  interface Props {
    id: string;
    label: string;
    optional?: boolean;
    hint?: string;
    error?: string;
    class?: string;
    children: Snippet<[{ describedby: string | undefined; invalid: boolean }]>;
  }

  let { id, label, optional = false, hint, error, class: className = "", children }: Props = $props();
  const describedby = $derived([hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined);
</script>

<div class="flex min-w-0 flex-col gap-1.5 {className}">
  <label for={id} class="text-sm font-semibold text-fg">
    {label}
    {#if optional}<span class="font-normal text-muted">(optional)</span>{/if}
  </label>
  {@render children({ describedby, invalid: Boolean(error) })}
  {#if hint && !error}<p id="{id}-hint" class="text-xs text-muted">{hint}</p>{/if}
  {#if hint && error}<p id="{id}-hint" class="sr-only">{hint}</p>{/if}
  {#if error}
    <p id="{id}-error" class="flex items-start gap-1.5 text-sm font-semibold text-accent-fg">
      <QIcon name="warning" size={16} class="mt-0.5" />{error}
    </p>
  {/if}
</div>
