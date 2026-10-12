<script lang="ts">
  /**
   * Trip composer: the quote form as a sentence the visitor completes (DESIGN.md signature 2).
   *
   *   <TripComposer client:visible models={toComposerModels(models, categories)} />
   *   <TripComposer client:visible models={...} defaultModelSlug="toyota-corolla" compact />
   *   <TripComposer client:visible models={...} defaultTripType="outstation" defaultDestination="Murree" />
   *
   * Step 1: "I need a [car] [with a driver] for [trip] from [when] to [when], picking up in [area]."
   * with a live estimate from catalog rates. Step 2: name, phone, optional email/passengers/message,
   * honeypot and Turnstile. Submit -> POST /api/quote -> reference INQ-xxxx + WhatsApp/Call.
   *
   * Deep links: /quote/?model=<slug>&service=with_driver|self_drive&trip=<tripType>&pickup=<text>&to=<text>
   * An unsent draft is kept in sessionStorage. Layout adapts to its container (container queries),
   * so the same island works full width on /quote/ and in a sidebar with `compact`.
   */
  import { onMount, tick } from "svelte";
  import { formatOpeningHours, site } from "@/config/site";
  import type { ServiceType, TripType } from "@/lib/catalog-types";
  import { formatPkPhone, normalizePkPhone } from "@/lib/format";
  import { telUrl, whatsappUrl } from "@/lib/links";
  import {
    captureAttribution,
    clearDraft,
    emailError,
    loadDraft,
    phoneError,
    saveDraft,
    submitQuote,
    type QuoteErrorCode,
    type QuotePayload,
  } from "@/lib/quote-client";
  import DetailsStep from "./DetailsStep.svelte";
  import EstimateCard from "./EstimateCard.svelte";
  import OptionList from "./OptionList.svelte";
  import PlacePicker from "./PlacePicker.svelte";
  import QIcon from "./QIcon.svelte";
  import SuccessView from "./SuccessView.svelte";
  import Token from "./Token.svelte";
  import WhenPicker from "./WhenPicker.svelte";
  import {
    AIRPORT_PICKUP,
    DAY_MS,
    HOUR_MS,
    PICKUP_SUGGESTIONS,
    SERVICE_OPTIONS,
    SERVICE_PHRASE,
    SERVICE_TYPES,
    TRIP_OPTIONS,
    TRIP_PHRASE,
    TRIP_TYPES,
    carOptions,
    computeEstimate,
    defaultWindow,
    formatWhen,
    inquiryCategory,
    pickupShortcuts,
    returnShortcuts,
    tripSentence,
    validateTrip,
    wantsPassengers,
    type TripErrorKey,
  } from "./trip";
  import type { ComposerModel, DetailsState, ListOption, PlaceSuggestion, TokenKey, TripComposerProps, TripState } from "./types";

  let { models, defaultModelSlug, defaultServiceType, defaultTripType, defaultPickup, defaultDestination, compact = false }: TripComposerProps =
    $props();

  const uid = $props.id();

  /* ---------------------------------------------------------------------------------------- */
  /* Initial state (identical on the server and at hydration: see formatWhen)                  */
  /* ---------------------------------------------------------------------------------------- */

  const isService = (v: unknown): v is ServiceType => SERVICE_TYPES.includes(v as ServiceType);
  const isTrip = (v: unknown): v is TripType => TRIP_TYPES.includes(v as TripType);
  const findModel = (slug: string | null | undefined): ComposerModel | undefined => (slug ? models.find((m) => m.slug === slug) : undefined);
  const offers = (m: ComposerModel, s: ServiceType) => (s === "with_driver" ? Boolean(m.rates.withDriver) : Boolean(m.rates.selfDrive));

  /** A car offered only one way forces that service. */
  function fitService(model: ComposerModel | undefined, service: ServiceType): ServiceType {
    if (!model || offers(model, service)) return service;
    return service === "self_drive" ? "with_driver" : "self_drive";
  }

  function initialTrip(at: number): TripState {
    const model = findModel(defaultModelSlug);
    const tripType: TripType = isTrip(defaultTripType) ? defaultTripType : "within_city";
    const serviceType = fitService(model, isService(defaultServiceType) ? defaultServiceType : "with_driver");
    const { pickupAt, returnAt } = defaultWindow(at, tripType);
    return {
      modelSlug: model?.slug ?? "",
      serviceType,
      tripType,
      pickupAt,
      returnAt,
      pickup: (defaultPickup ?? (tripType === "airport" ? AIRPORT_PICKUP : "")).trim().slice(0, 160),
      destination: (defaultDestination ?? "").trim().slice(0, 160),
    };
  }

  const bootNow = Date.now();
  let now = $state(bootNow);
  let trip = $state<TripState>(initialTrip(bootNow));
  let details = $state<DetailsState>({ name: "", phone: "", email: "", passengers: "", message: "" });
  let website = $state(""); // honeypot
  let token = $state(""); // Turnstile

  /** 1 = trip, 2 = details, 3 = sent. */
  let step = $state<1 | 2 | 3>(1);
  let open = $state<TokenKey | null>(null);
  let showTripErrors = $state(false);
  let notice = $state("");
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  let detailsAttempted = $state(false);
  let serverErrors = $state<Partial<Record<keyof DetailsState, string>>>({});
  let submitting = $state(false);
  let formError = $state("");
  let errorCode = $state<QuoteErrorCode | "">("");
  let resetSignal = $state(0);
  let reference = $state("");
  let customerPhone = $state("");
  let ready = false;
  /** False in the prerendered HTML: the WhatsApp link must not carry build-day dates. */
  let hydrated = $state(false);

  /* ---------------------------------------------------------------------------------------- */
  /* Derived                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  const model = $derived(findModel(trip.modelSlug));
  const showPassengers = $derived(wantsPassengers(model));
  const passengers = $derived.by(() => {
    const n = Number(details.passengers.trim());
    return details.passengers.trim() && Number.isInteger(n) && n >= 1 && n <= 60 ? n : null;
  });
  const estimate = $derived(computeEstimate(models, trip, showPassengers ? passengers : null));
  const tripErrors = $derived(validateTrip(trip, now));
  const shownTripErrors = $derived(showTripErrors ? tripErrors : {});
  const errorList = $derived(
    (["destination", "from", "to", "pickup"] as TripErrorKey[]).filter((k) => shownTripErrors[k]).map((k) => [k, shownTripErrors[k] as string] as const),
  );
  const sentence = $derived(tripSentence(trip, models));

  const carList = $derived(carOptions(models, trip.serviceType));
  const serviceList = $derived<ListOption[]>(
    SERVICE_OPTIONS.map((o) => {
      const unavailable = model ? !offers(model, o.value) : false;
      return { value: o.value, label: o.label, hint: unavailable && model ? `Not offered for the ${model.name}` : o.hint, disabled: unavailable };
    }),
  );
  const tripList: ListOption[] = TRIP_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }));
  const ROUTE_HINTS: Record<string, string> = {
    Islamabad: "M-2 motorway",
    Murree: "Via Islamabad",
    Sialkot: "M-11 motorway",
    Multan: "M-3 and M-4 motorways",
  };
  const destinationSuggestions: PlaceSuggestion[] = site.routes.map((r) => ({ label: r.city, hint: ROUTE_HINTS[r.city] }));

  const clip = (text: string, max = 38) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);
  const carArticle = $derived(model ? (/^[aeiou]/i.test(model.name) ? "an" : "a") : "");
  const pickupShort = $derived(pickupShortcuts(now, trip.pickupAt));
  const returnShort = $derived(returnShortcuts(trip.pickupAt));

  function validateDetails(d: DetailsState, withPassengers: boolean): Partial<Record<keyof DetailsState, string>> {
    const out: Partial<Record<keyof DetailsState, string>> = {};
    if (d.name.trim().length < 2) out.name = "Please enter your name.";
    const phone = phoneError(d.phone);
    if (phone) out.phone = phone;
    const email = emailError(d.email);
    if (email) out.email = email;
    if (withPassengers && d.passengers.trim()) {
      const n = Number(d.passengers.trim());
      if (!Number.isInteger(n) || n < 1 || n > 60) out.passengers = "Enter a number from 1 to 60. For bigger groups, tell us in the message.";
    }
    if (d.message.length > 1000) out.message = "Please keep the message under 1000 characters.";
    return out;
  }

  const detailErrors = $derived({ ...serverErrors, ...(detailsAttempted ? validateDetails(details, showPassengers) : {}) });
  const passengersHint = $derived(
    model && passengers && passengers > model.seats
      ? `The ${model.name} seats ${model.seats}. We will suggest a bigger vehicle or a second one.`
      : undefined,
  );

  const name = $derived(details.name.trim());
  const whatsappTrip = $derived(
    hydrated
      ? whatsappUrl(`Assalam o Alaikum! ${sentence}${name ? ` My name is ${name}.` : ""}`)
      : whatsappUrl("Assalam o Alaikum! I'd like a quote for a car in Lahore."),
  );
  const whatsappDone = $derived(whatsappUrl(`Assalam o Alaikum! My quote reference is ${reference}.${name ? ` My name is ${name}.` : ""}`));
  const tel = telUrl();
  const hours = formatOpeningHours();

  /* ---------------------------------------------------------------------------------------- */
  /* Sentence actions                                                                          */
  /* ---------------------------------------------------------------------------------------- */

  function toggle(key: TokenKey, next: boolean) {
    open = next ? key : open === key ? null : open;
  }

  function say(message: string) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ""), 7000);
  }

  function selectCar(slug: string) {
    trip.modelSlug = slug;
    open = null;
    const m = findModel(slug);
    const service = fitService(m, trip.serviceType);
    if (m && service !== trip.serviceType) {
      trip.serviceType = service;
      say(
        service === "with_driver"
          ? `The ${m.name} comes with a driver, so we switched to with a driver.`
          : `The ${m.name} is offered for self drive only, so we switched to self drive.`,
      );
    }
  }

  function selectService(value: string) {
    if (isService(value)) trip.serviceType = value;
    open = null;
  }

  function applyTripType(value: TripType) {
    trip.tripType = value;
    if (value === "monthly" && trip.returnAt - trip.pickupAt < 30 * DAY_MS) trip.returnAt = trip.pickupAt + 30 * DAY_MS;
    if (value === "airport" && !trip.pickup.trim()) trip.pickup = AIRPORT_PICKUP;
  }

  function selectTrip(value: string) {
    if (!isTrip(value)) return;
    applyTripType(value);
    // Outstation needs a destination: open that bracket next.
    open = value === "outstation" && !trip.destination.trim() ? "destination" : null;
  }

  function setPickupAt(ms: number) {
    const duration = trip.returnAt - trip.pickupAt;
    trip.pickupAt = ms;
    if (trip.returnAt <= ms) trip.returnAt = ms + Math.max(HOUR_MS, duration);
  }

  function setReturnAt(ms: number) {
    trip.returnAt = ms;
  }

  // Also called while a place panel closes (typed text kept on outside tap), so only close our own panel.
  function setPickup(value: string) {
    trip.pickup = value.trim().slice(0, 160);
    if (open === "pickup") open = null;
  }

  function setDestination(value: string) {
    trip.destination = value.trim().slice(0, 160);
    if (open === "destination") open = null;
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Steps                                                                                     */
  /* ---------------------------------------------------------------------------------------- */

  async function goToDetails() {
    open = null;
    now = Date.now();
    const errors = validateTrip(trip, now);
    const first = (["destination", "from", "to", "pickup"] as TripErrorKey[]).find((k) => errors[k]);
    if (first) {
      showTripErrors = true;
      await tick();
      document.getElementById(`${uid}-${first}-button`)?.focus();
      return;
    }
    showTripErrors = false;
    formError = "";
    step = 2;
    await tick();
    document.getElementById(`${uid}-name`)?.focus();
  }

  async function backToTrip() {
    step = 1;
    token = "";
    formError = "";
    errorCode = "";
    await tick();
    document.getElementById(`${uid}-continue`)?.focus();
  }

  async function submit() {
    if (submitting) return;
    detailsAttempted = true;
    serverErrors = {};
    formError = "";
    errorCode = "";

    const errors = validateDetails(details, showPassengers);
    const firstField = (["name", "phone", "email", "passengers", "message"] as const).find((k) => errors[k]);
    if (firstField) {
      await tick();
      document.getElementById(`${uid}-${firstField}`)?.focus();
      return;
    }

    now = Date.now();
    const tripProblem = Object.values(validateTrip(trip, now))[0];
    if (tripProblem) {
      formError = `${tripProblem} Go back to your trip to change it.`;
      errorCode = "validation";
      return;
    }
    if (!token) {
      formError = "The security check is still running. Give it a moment, then press Get a quote again.";
      errorCode = "turnstile"; // shows the WhatsApp / Call fallback in case the check never finishes
      return;
    }

    submitting = true;
    const attribution = captureAttribution();
    const payload: QuotePayload = {
      name: details.name.trim(),
      phone: details.phone.trim(),
      email: details.email.trim() || undefined,
      modelSlug: model?.slug,
      category: inquiryCategory(model),
      serviceType: trip.serviceType,
      tripType: trip.tripType,
      pickupAt: trip.pickupAt,
      returnAt: trip.returnAt,
      pickupLocation: trip.pickup.trim() || undefined,
      destination: trip.tripType === "outstation" ? trip.destination.trim() || undefined : undefined,
      passengers: showPassengers && passengers ? passengers : undefined,
      message: details.message.trim() || undefined,
      estimateTotal: estimate.ok ? estimate.estimate.total : undefined,
      landingPage: attribution.landingPage,
      utm: attribution.utm,
      website,
      turnstileToken: token,
    };

    const result = await submitQuote(payload);
    submitting = false;
    token = "";
    resetSignal += 1; // Turnstile tokens are single use

    if (result.ok) {
      reference = result.ref;
      const e164 = normalizePkPhone(details.phone);
      customerPhone = e164 ? formatPkPhone(e164) : "";
      clearDraft();
      step = 3;
      return;
    }

    // A rejection the visitor cannot fix by editing a field still gets the WhatsApp / Call fallback.
    errorCode = result.code === "validation" && !result.fields ? "server" : result.code;
    formError = result.error;
    if (result.fields) {
      const f = result.fields;
      const next: Partial<Record<keyof DetailsState, string>> = {};
      for (const key of ["name", "phone", "email", "passengers", "message"] as const) if (f[key]) next[key] = f[key];
      serverErrors = next;
      const tripField = f.pickupAt ?? f.returnAt;
      if (tripField) formError = `${tripField} Go back to your trip to change it.`;
      const firstServer = (["name", "phone", "email", "passengers", "message"] as const).find((k) => next[k]);
      if (firstServer) {
        await tick();
        document.getElementById(`${uid}-${firstServer}`)?.focus();
      }
    }
  }

  async function restart() {
    step = 1;
    reference = "";
    details.message = "";
    detailsAttempted = false;
    serverErrors = {};
    showTripErrors = false;
    formError = "";
    errorCode = "";
    now = Date.now();
    const fresh = defaultWindow(now, trip.tripType);
    trip.pickupAt = fresh.pickupAt;
    trip.returnAt = fresh.returnAt;
    await tick();
    document.getElementById(`${uid}-car-button`)?.focus();
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Draft, deep links, attribution                                                            */
  /* ---------------------------------------------------------------------------------------- */

  interface Draft {
    v: 1;
    trip?: Partial<TripState>;
    details?: Partial<DetailsState>;
  }

  /** Props set by the page win over the draft (a car page keeps its car); dates only if still ahead. */
  function restoreDraft(at: number) {
    const draft = loadDraft<Draft>();
    if (!draft || draft.v !== 1) return;
    const t = draft.trip ?? {};
    if (!defaultModelSlug && typeof t.modelSlug === "string" && (t.modelSlug === "" || findModel(t.modelSlug))) trip.modelSlug = t.modelSlug;
    if (!defaultServiceType && isService(t.serviceType)) trip.serviceType = t.serviceType;
    if (!defaultTripType && isTrip(t.tripType)) trip.tripType = t.tripType;
    if (!defaultPickup && typeof t.pickup === "string" && t.pickup.trim()) trip.pickup = t.pickup.trim().slice(0, 160);
    if (!defaultDestination && typeof t.destination === "string") trip.destination = t.destination.trim().slice(0, 160);
    if (typeof t.pickupAt === "number" && typeof t.returnAt === "number" && t.pickupAt > at && t.returnAt > t.pickupAt) {
      trip.pickupAt = t.pickupAt;
      trip.returnAt = t.returnAt;
    }
    trip.serviceType = fitService(findModel(trip.modelSlug), trip.serviceType);
    const d = draft.details ?? {};
    for (const key of ["name", "phone", "email", "passengers", "message"] as const) {
      const value = d[key];
      if (typeof value === "string") details[key] = value.slice(0, key === "message" ? 1000 : 120);
    }
  }

  function applyUrlParams() {
    let params: URLSearchParams;
    try {
      params = new URL(window.location.href).searchParams;
    } catch {
      return;
    }
    const m = findModel(params.get("model") ?? params.get("car"));
    if (m) trip.modelSlug = m.slug;
    const service = params.get("service");
    if (isService(service)) trip.serviceType = service;
    const tripType = params.get("trip");
    if (isTrip(tripType)) applyTripType(tripType);
    const pickup = params.get("pickup")?.trim();
    if (pickup) trip.pickup = pickup.slice(0, 160);
    const to = (params.get("to") ?? params.get("destination"))?.trim();
    if (to) trip.destination = to.slice(0, 160);
    trip.serviceType = fitService(findModel(trip.modelSlug), trip.serviceType);
  }

  onMount(() => {
    const at = Date.now();
    now = at;
    // Re-anchor the default dates to the visitor's clock (the labels read the same: "tomorrow").
    const fresh = defaultWindow(at, trip.tripType);
    trip.pickupAt = fresh.pickupAt;
    trip.returnAt = fresh.returnAt;
    restoreDraft(at);
    applyUrlParams();
    applyTripType(trip.tripType); // monthly keeps a 30 day window, airport gets its default pickup
    captureAttribution();
    ready = true;
    hydrated = true;
    // Keep "today" / "tomorrow" honest when the tab stays open.
    const clock = setInterval(() => (now = Date.now()), 60_000);
    return () => {
      clearInterval(clock);
      clearTimeout(noticeTimer);
    };
  });

  $effect(() => {
    const snapshot = { v: 1, trip: $state.snapshot(trip), details: $state.snapshot(details) };
    if (!ready || step === 3) return;
    saveDraft(snapshot);
  });

  const primaryButton =
    "inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent-fill px-8 text-base font-semibold text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_28px_-14px_color-mix(in_oklab,var(--accent)_70%,transparent)] transition-[transform,background-color] duration-200 hover:bg-accent-fill-hover active:scale-[0.97]";
</script>

<div class="trip-composer @container" data-fab-hide data-trip-composer>
  <div class="relative rounded-card border border-line bg-surface shadow-soft">
    <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
      <div
        class="absolute -top-32 -left-24 size-96 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_13%,transparent),transparent)]"
      ></div>
      <div class="absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--accent)_60%,transparent),transparent)]"></div>
    </div>

    {#if step === 3}
      <SuccessView {uid} {reference} {customerPhone} whatsappHref={whatsappDone} telHref={tel} {hours} onrestart={restart} />
    {:else}
      <div class={["relative grid", !compact && "@4xl:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]"]}>
        <div class={["min-w-0 p-5 @md:p-7", !compact && "@4xl:p-10"]}>
          <div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex gap-1.5" aria-hidden="true">
              <span class="h-1 w-7 rounded-full bg-accent"></span>
              <span class={["h-1 w-7 rounded-full transition-colors duration-300", step === 2 ? "bg-accent" : "bg-line-strong/40"]}></span>
            </div>
            <p class="text-sm text-muted">
              <span class="font-semibold text-fg">Step {step} of 2</span>, {step === 1 ? "your trip" : "your details"}
            </p>
          </div>

          {#if step === 1}
            <div
              data-composer-sentence
              role="group"
              aria-label="Your trip"
              class={[
                "relative font-sans font-semibold tracking-[-0.015em] text-muted",
                compact ? "text-[clamp(1.0625rem,0.95rem+0.9cqi,1.375rem)] leading-[1.95]" : "text-[clamp(1.1875rem,0.8rem+1.9cqi,2rem)] leading-[1.9]",
              ]}
            >
              I need {carArticle}
              <Token id="{uid}-car" name="Car" text={model ? model.name : "any suitable car"} open={open === "car"} onopenchange={(v) => toggle("car", v)} panelWidth={400}>
                <OptionList id="{uid}-car" label="Choose a car" options={carList} value={trip.modelSlug} onselect={selectCar} />
              </Token>
              <Token
                id="{uid}-service"
                name="Driver"
                text={SERVICE_PHRASE[trip.serviceType]}
                open={open === "service"}
                onopenchange={(v) => toggle("service", v)}
              >
                <OptionList id="{uid}-service" label="With a driver or self drive" options={serviceList} value={trip.serviceType} onselect={selectService} />
              </Token>
              for
              <Token id="{uid}-trip" name="Trip type" text={TRIP_PHRASE[trip.tripType]} open={open === "trip"} onopenchange={(v) => toggle("trip", v)}>
                <OptionList id="{uid}-trip" label="Type of trip" options={tripList} value={trip.tripType} onselect={selectTrip} />
              </Token>
              {#if trip.tripType === "outstation"}
                to
                <Token
                  id="{uid}-destination"
                  name="Destination"
                  popup="dialog"
                  text={trip.destination ? clip(trip.destination) : "choose a city"}
                  empty={!trip.destination}
                  invalid={Boolean(shownTripErrors.destination)}
                  open={open === "destination"}
                  onopenchange={(v) => toggle("destination", v)}
                >
                  <PlacePicker
                    id="{uid}-destination"
                    label="Where are you heading?"
                    value={trip.destination}
                    suggestions={destinationSuggestions}
                    placeholder="City or town"
                    hint="Pick a city or type any destination in Pakistan."
                    onselect={setDestination}
                  />
                </Token>
              {/if}
              from
              <Token
                id="{uid}-from"
                name="Pickup date and time"
                popup="dialog"
                text={formatWhen(trip.pickupAt, now)}
                invalid={Boolean(shownTripErrors.from)}
                open={open === "from"}
                onopenchange={(v) => toggle("from", v)}
                panelWidth={340}
              >
                <WhenPicker
                  id="{uid}-from"
                  label="Pickup"
                  value={trip.pickupAt}
                  min={now}
                  shortcuts={pickupShort}
                  error={tripErrors.from}
                  onchange={setPickupAt}
                  ondone={() => (open = null)}
                />
              </Token>
              to
              <Token
                id="{uid}-to"
                name="Return date and time"
                popup="dialog"
                text={formatWhen(trip.returnAt, now)}
                invalid={Boolean(shownTripErrors.to)}
                open={open === "to"}
                onopenchange={(v) => toggle("to", v)}
                panelWidth={340}
              >
                <WhenPicker
                  id="{uid}-to"
                  label="Return"
                  value={trip.returnAt}
                  min={trip.pickupAt}
                  shortcuts={returnShort}
                  error={tripErrors.to}
                  onchange={setReturnAt}
                  ondone={() => (open = null)}
                />
              </Token>, picking up in
              <Token
                id="{uid}-pickup"
                name="Pickup area"
                popup="dialog"
                text={trip.pickup ? clip(trip.pickup) : "choose an area"}
                empty={!trip.pickup}
                invalid={Boolean(shownTripErrors.pickup)}
                open={open === "pickup"}
                onopenchange={(v) => toggle("pickup", v)}
              >
                <PlacePicker
                  id="{uid}-pickup"
                  label="Where should we pick you up?"
                  value={trip.pickup}
                  suggestions={PICKUP_SUGGESTIONS}
                  placeholder="Area, street or landmark"
                  hint="Pick an area or type your address. We confirm the exact spot on WhatsApp."
                  onselect={setPickup}
                />
              </Token>.
            </div>

            {#if errorList.length}
              <ul class="mt-5 flex flex-col gap-1.5">
                {#each errorList as [key, message] (key)}
                  <li id="{uid}-{key}-error" class="flex items-start gap-2 text-sm font-semibold text-accent-fg">
                    <QIcon name="warning" size={16} class="mt-0.5" />{message}
                  </li>
                {/each}
              </ul>
            {/if}
            <p class={["text-sm text-muted", notice && "mt-4"]} role="status">{notice}</p>

            <noscript>
              <p class="mt-5 text-sm text-muted">This form needs JavaScript. You can also WhatsApp us or call, and we will price your trip straight away.</p>
            </noscript>

            <div class="mt-8 flex flex-col items-stretch gap-4 @lg:flex-row @lg:items-center @lg:gap-7">
              <button id="{uid}-continue" type="button" class={primaryButton} onclick={goToDetails}>
                Continue<QIcon name="arrowRight" size={20} />
              </button>
              <p class="text-center text-sm text-muted @lg:text-left">
                Prefer chat?
                <a
                  href={whatsappTrip}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-1 inline-flex items-center gap-1.5 font-semibold text-fg underline-offset-4 hover:underline"
                >
                  <QIcon name="whatsapp" size={16} class="text-whatsapp" />WhatsApp us
                </a>
              </p>
            </div>
          {:else}
            <DetailsStep
              {uid}
              bind:details
              bind:website
              bind:token
              errors={detailErrors}
              {showPassengers}
              {passengersHint}
              {sentence}
              {submitting}
              {formError}
              {errorCode}
              {resetSignal}
              whatsappHref={whatsappTrip}
              telHref={tel}
              onsubmit={submit}
              onback={backToTrip}
            />
          {/if}
        </div>

        <aside
          aria-label="Price estimate"
          class={[
            "min-w-0 rounded-b-card border-t border-line bg-surface-2/40 p-5 @md:p-7",
            !compact && "@4xl:rounded-bl-none @4xl:rounded-r-card @4xl:border-t-0 @4xl:border-l @4xl:p-8",
          ]}
        >
          <EstimateCard result={estimate} {compact} />
        </aside>
      </div>
    {/if}
  </div>
</div>
