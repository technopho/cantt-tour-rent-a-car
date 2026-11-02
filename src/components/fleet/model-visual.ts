/**
 * Which picture a model gets, and how it must be captioned.
 *
 * A real catalog photo always wins. Otherwise the AI image from the media manifest, which is always
 * captioned "Representative image" (DESIGN.md). Undefined when neither exists, and every caller then
 * sets the name large instead of showing a blank plate.
 */
import type { CatalogModel } from "@/lib/catalog-types";
import { REPRESENTATIVE, captionFor, fleetImage, road, scene, showsVehicle, still, type Img } from "@/lib/media";

type VisualModel = Pick<CatalogModel, "slug" | "images">;
type SceneModel = Pick<CatalogModel, "category" | "rates">;

export interface ModelVisual {
  img: Img;
  representative: boolean;
}

/** A picture ready to place, with its caption if it needs one. */
export interface Visual {
  img: Img;
  caption?: string;
}

export { REPRESENTATIVE };

export function modelVisual(model: VisualModel): ModelVisual | undefined {
  const photo = model.images[0];
  if (photo) return { img: { ...photo, srcset: photo.srcset || undefined }, representative: false };
  const ai = fleetImage(model.slug);
  return ai ? { img: ai, representative: true } : undefined;
}

/**
 * Pictures that suit a model's page but show no particular car, best first: how it is hired (with a driver,
 * self drive), else the road. A model page with no picture of its own opens on the first of these rather than
 * on a text-only hero, and a model page places one between its specs and its rates. Never another model's
 * photo: that would put the wrong car under this name.
 */
export function modelScenes(model: SceneModel): Img[] {
  const group = model.category === "van" || model.category === "coaster";
  const list = group
    ? [scene("vans"), road("motorway"), still("trails"), still("terrain")]
    : [
        model.rates.selfDrive ? scene("selfdrive") : undefined,
        model.rates.withDriver ? scene("chauffeur") : undefined,
        model.category === "suv" || model.category === "luxury" ? scene("airport") : scene("corporate"),
        scene("contact"),
        still("trails"),
      ];
  return list.filter((img): img is Img => Boolean(img));
}

/**
 * Pictures for a page whose first interlude comes right after a list of cars: that slot gets the first picture
 * with no vehicle in it (a car there reads as one more car in the list, under the wrong name), or none at all;
 * the other pictures keep their order for the later slots.
 */
export function afterCarList(visuals: readonly Visual[]): (Visual | undefined)[] {
  const i = visuals.findIndex((visual) => !showsVehicle(visual.img));
  if (i < 0) return [undefined, ...visuals];
  return [visuals[i], ...visuals.slice(0, i), ...visuals.slice(i + 1)];
}

/** Largest and most luxurious first, for every list the visitor cannot sort. */
export const byLargest = (a: Pick<CatalogModel, "rates">, b: Pick<CatalogModel, "rates">) => b.rates.fromPrice - a.rates.fromPrice;

/**
 * Pictures for a page's interludes, best first: its scenes in the order given, then the cars that belong on
 * the page. Each picture appears once, and never one listed in `exclude` (the hero). Scenes carry their small
 * print from captionFor ("Representative image" when a vehicle shows, a photographer credit on a photo).
 */
export function pageVisuals(
  scenes: readonly (Img | undefined)[],
  models: readonly Pick<CatalogModel, "slug" | "images" | "make" | "model" | "rates">[],
  /** Pictures already on the page, usually the hero. */
  exclude: readonly (Img | undefined)[] = [],
): Visual[] {
  const out: Visual[] = [];
  const seen = new Set<string>(exclude.filter((img): img is Img => Boolean(img)).map((img) => img.src));
  const add = (visual: Visual) => {
    if (seen.has(visual.img.src)) return;
    seen.add(visual.img.src);
    out.push(visual);
  };
  for (const img of scenes) if (img) add({ img, caption: captionFor(img) });
  for (const model of [...models].sort(byLargest)) {
    const visual = modelVisual(model);
    if (visual) add({ img: visual.img, caption: visual.representative ? `${model.make} ${model.model}. ${REPRESENTATIVE}` : `${model.make} ${model.model}` });
  }
  return out;
}
