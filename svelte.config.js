import { vitePreprocess } from "@astrojs/svelte";

/** Svelte 5 islands (runes mode). TypeScript in <script lang="ts"> is handled by vitePreprocess. */
export default {
  preprocess: vitePreprocess(),
};
