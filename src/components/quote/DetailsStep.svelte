<script lang="ts">
  /**
   * Step 2: contact details, honeypot, Cloudflare Turnstile and the submit button.
   * Turnstile's api.js is requested only when this step mounts and the widget is removed when the
   * visitor goes back to edit the trip. Tokens are single use: the parent bumps `resetSignal`
   * after every submit attempt and the widget issues a fresh one.
   */
  import { onMount, untrack } from "svelte";
  import { TURNSTILE_SITE_KEY, loadTurnstile, type QuoteErrorCode, type TurnstileApi } from "@/lib/quote-client";
  import Field from "./Field.svelte";
  import QIcon from "./QIcon.svelte";
  import type { DetailsState } from "./types";

  interface Props {
    uid: string;
    details: DetailsState;
    website: string;
    token: string;
    errors: Partial<Record<keyof DetailsState, string>>;
    showPassengers: boolean;
    passengersHint?: string;
    sentence: string;
    submitting: boolean;
    formError: string;
    errorCode: QuoteErrorCode | "";
    resetSignal: number;
    whatsappHref: string;
    telHref: string;
    onsubmit: () => void;
    onback: () => void;
  }

  let {
    uid,
    details = $bindable(),
    website = $bindable(),
    token = $bindable(),
    errors,
    showPassengers,
    passengersHint,
    sentence,
    submitting,
    formError,
    errorCode,
    resetSignal,
    whatsappHref,
    telHref,
    onsubmit,
    onback,
  }: Props = $props();

  let widgetBox: HTMLDivElement | undefined = $state();
  let widgetState = $state<"loading" | "ready" | "error">("loading");
  let compactWidget = $state(false);
  let api: TurnstileApi | null = null;
  let widgetId: string | undefined;
  let destroyed = false;

  function renderWidget() {
    widgetState = "loading";
    loadTurnstile()
      .then((turnstile) => {
        if (destroyed || !widgetBox) return;
        api = turnstile;
        widgetId = turnstile.render(widgetBox, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "quote",
          theme: "auto",
          size: compactWidget ? "compact" : "flexible",
          callback: (t) => {
            token = t;
            widgetState = "ready";
          },
          "expired-callback": () => (token = ""),
          "timeout-callback": () => (token = ""),
          "error-callback": () => {
            token = "";
            widgetState = "error";
          },
        });
        if (widgetState === "loading") widgetState = "ready";
      })
      .catch(() => {
        widgetState = "error";
      });
  }

  function retryWidget() {
    if (api && widgetId) {
      widgetState = "ready";
      api.reset(widgetId);
    } else renderWidget();
  }

  onMount(() => {
    // Turnstile "flexible" needs at least 300px; very narrow screens get the compact widget.
    compactWidget = (widgetBox?.clientWidth ?? 320) < 300;
    renderWidget();
    return () => {
      destroyed = true;
      if (api && widgetId) api.remove(widgetId);
    };
  });

  $effect(() => {
    void resetSignal;
    untrack(() => {
      if (api && widgetId) {
        token = "";
        api.reset(widgetId);
      }
    });
  });

  const input =
    "h-12 w-full min-w-0 rounded-card border border-line-strong bg-bg px-4 text-base text-fg transition-colors placeholder:text-muted/80 hover:border-fg/40 focus:border-accent aria-invalid:border-accent-fg";
  const showFallback = $derived(errorCode === "network" || errorCode === "server" || errorCode === "rate_limited" || errorCode === "turnstile");
</script>

<form
  novalidate
  aria-labelledby="{uid}-details-title"
  aria-busy={submitting}
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit();
  }}
>
  <div class="flex flex-col gap-3 rounded-card border border-line bg-bg/40 p-4 @lg:flex-row @lg:items-start @lg:justify-between">
    <p class="text-sm leading-relaxed text-muted"><span class="sr-only">{"Your trip: "}</span>{sentence}</p>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
      onclick={onback}
    >
      <QIcon name="pencil" size={14} />Edit trip
    </button>
  </div>

  <p id="{uid}-details-title" class="mt-7 font-display text-display-sm text-fg">Where should we send your price?</p>
  <p class="mt-2 text-sm text-muted">We reply on WhatsApp with the final price. No account, no payment here.</p>

  <div class="mt-6 grid gap-5 @3xl:grid-cols-2">
    <Field id="{uid}-name" label="Your name" error={errors.name}>
      {#snippet children({ describedby, invalid })}
        <input
          id="{uid}-name"
          bind:value={details.name}
          type="text"
          autocomplete="name"
          autocapitalize="words"
          maxlength="80"
          required
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedby}
          class={input}
        />
      {/snippet}
    </Field>

    <Field id="{uid}-phone" label="Mobile number" hint="Pakistani mobile, e.g. 0300 1234567. We reply on WhatsApp." error={errors.phone}>
      {#snippet children({ describedby, invalid })}
        <input
          id="{uid}-phone"
          bind:value={details.phone}
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          placeholder="0300 1234567"
          maxlength="20"
          required
          aria-required="true"
          aria-invalid={invalid}
          aria-describedby={describedby}
          class="{input} tabular-nums"
        />
      {/snippet}
    </Field>

    <Field id="{uid}-email" label="Email" optional hint="For a written copy of the quote." error={errors.email}>
      {#snippet children({ describedby, invalid })}
        <input
          id="{uid}-email"
          bind:value={details.email}
          type="email"
          inputmode="email"
          autocomplete="email"
          maxlength="120"
          aria-invalid={invalid}
          aria-describedby={describedby}
          class={input}
        />
      {/snippet}
    </Field>

    {#if showPassengers}
      <Field id="{uid}-passengers" label="Passengers" optional hint={passengersHint ?? "Helps us pick the right size of car or van."} error={errors.passengers}>
        {#snippet children({ describedby, invalid })}
          <input
            id="{uid}-passengers"
            bind:value={details.passengers}
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="2"
            aria-invalid={invalid}
            aria-describedby={describedby}
            class="{input} tabular-nums"
          />
        {/snippet}
      </Field>
    {/if}

    <Field id="{uid}-message" label="Anything else?" optional class="@3xl:col-span-2" error={errors.message}>
      {#snippet children({ describedby, invalid })}
        <textarea
          id="{uid}-message"
          bind:value={details.message}
          rows="3"
          maxlength="1000"
          placeholder="Flight number, stops on the way, timings, decoration for the wedding car..."
          aria-invalid={invalid}
          aria-describedby={describedby}
          class="{input} h-auto min-h-24 resize-y py-3 leading-relaxed"
        ></textarea>
      {/snippet}
    </Field>
  </div>

  <!-- Honeypot: invisible to people (and to assistive tech), tempting to bots. -->
  <div class="hp" aria-hidden="true">
    <label for="{uid}-website">Leave this field empty</label>
    <input id="{uid}-website" name="contact_website" type="text" tabindex="-1" autocomplete="off" bind:value={website} />
  </div>

  <div class="mt-6">
    <div bind:this={widgetBox} class={compactWidget ? "min-h-[140px]" : "min-h-[65px]"}></div>
    {#if widgetState === "error"}
      <p class="mt-2 text-sm text-muted" role="status">
        The security check could not load. Check your connection or ad blocker and
        <button type="button" class="font-semibold text-fg underline underline-offset-2" onclick={retryWidget}>try again</button>, or
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" class="font-semibold text-fg underline underline-offset-2">WhatsApp us</a>.
      </p>
    {/if}
  </div>

  <p class="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
    <QIcon name="lock" size={14} class="mt-0.5 shrink-0" />
    <span>
      By sending this request you agree that we may contact you on WhatsApp or by phone about this trip. We use your details only to answer
      it. Nothing is booked or charged until you confirm. See our <a href="/policies/" class="font-semibold text-fg underline underline-offset-2"
        >policies</a
      >.
    </span>
  </p>

  {#if formError}
    <div role="alert" class="mt-5 rounded-card border border-accent-fg/40 bg-accent-soft p-4">
      <p class="flex items-start gap-2 text-sm font-semibold text-fg">
        <QIcon name="warning" size={18} class="mt-px shrink-0 text-accent-fg" />{formError}
      </p>
      {#if showFallback}
        <div class="mt-3 flex flex-wrap gap-2 pl-6.5">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg hover:border-line-strong"
          >
            <QIcon name="whatsapp" size={16} class="text-whatsapp" />WhatsApp us
          </a>
          <a href={telHref} class="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-fg hover:bg-surface-2">
            <QIcon name="phone" size={16} />Call now
          </a>
        </div>
      {/if}
    </div>
  {/if}

  <div class="mt-6 flex flex-col-reverse items-stretch gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
    <button
      type="button"
      class="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] font-semibold text-fg transition-colors hover:bg-surface-2"
      onclick={onback}
    >
      <QIcon name="arrowLeft" size={18} />Back to your trip
    </button>
    <button
      type="submit"
      disabled={submitting}
      class="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent-fill px-8 text-base font-semibold text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_28px_-14px_color-mix(in_oklab,var(--accent)_70%,transparent)] transition-[transform,background-color] duration-200 hover:bg-accent-fill-hover active:scale-[0.97] disabled:cursor-progress disabled:opacity-70"
    >
      {#if submitting}
        <QIcon name="spinner" size={20} class="animate-spin" />Sending...
      {:else}
        Get a quote<QIcon name="arrowRight" size={20} />
      {/if}
    </button>
  </div>
</form>

<style>
  .hp {
    position: absolute;
    left: -10000px;
    top: auto;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  input:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
