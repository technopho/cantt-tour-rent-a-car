/**
 * Rhythm of the image-led fleet gallery. Pure and dependency free: the server uses it for the first
 * paint and the /cars/ filter script calls it again for whatever is left visible, so a filtered gallery
 * never has a hole in it.
 *
 *   full    a whole line, one car
 *   wide    seven columns, paired with a narrow plate
 *   narrow  five columns, set lower
 *   row     a model with no image: the name set large on a hairline
 *
 * Cars with a picture always come first and the name-only rows after them, under a hairline "Also in the
 * fleet" (picturesFirst). A large name row set straight above another car's picture reads as that
 * picture's label, which would put the wrong name on a car.
 */
export type GallerySlot = "full" | "wide" | "narrow" | "row";

/** Stable split: items with a picture in their given order, then the rest in their given order. */
export function picturesFirst<T>(items: readonly T[], hasImage: (item: T) => boolean): T[] {
  return [...items.filter(hasImage), ...items.filter((item) => !hasImage(item))];
}

export function gallerySlots(hasImage: readonly boolean[]): GallerySlot[] {
  const slots: GallerySlot[] = [];
  let pairNext = false;
  let flip = false;
  for (let i = 0; i < hasImage.length; i++) {
    if (!hasImage[i]) {
      slots.push("row");
    } else if (pairNext && hasImage[i + 1]) {
      slots.push(flip ? "narrow" : "wide", flip ? "wide" : "narrow");
      i++;
      flip = !flip;
      pairNext = false;
    } else {
      slots.push("full");
      pairNext = true;
    }
  }
  return slots;
}
