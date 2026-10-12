<script lang="ts">
  // Decorative inline icon for the composer island (see icons.ts). Always aria-hidden: pair it
  // with visible or sr-only text.
  import { ICONS, SMALL_GRID, type IconName } from "./icons";

  let { name, size = "1em", class: className = "" }: { name: IconName; size?: string | number; class?: string } = $props();
  const dim = $derived(typeof size === "number" ? `${size}px` : size);
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox={SMALL_GRID.has(name) ? "0 0 24 24" : "0 0 256 256"}
  width={dim}
  height={dim}
  fill="currentColor"
  aria-hidden="true"
  focusable="false"
  class="shrink-0 {className}"><path d={ICONS[name]} /></svg
>
