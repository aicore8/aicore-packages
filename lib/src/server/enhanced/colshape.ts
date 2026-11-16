import type { ZoneShape } from "../../shared";

let available: boolean | undefined;

/**
 * Server colshapes (`onColshapeEnter` / `onColshapeExit`), probed once: a test shape must exist after it is created.
 * Documented for Enhanced; Legacy builds ship the natives too, and where they work the caller only gains a trigger.
 */
export function hasColshapes(): boolean {
  if (available === undefined) {
    try {
      const id = CreateColshapeSphere(0, 0, -5000, 0.1);
      const valid = typeof id === "number" && id >= 0;
      // BOOL natives answer 1 / 0 in JS.
      available = valid && Boolean(DoesColshapeExist(id));
      if (valid) DeleteColshape(id);
    } catch {
      available = false;
    }
  }
  return available;
}

/** A poly zone (lib `ZoneShape`) as a colshape, or null without colshapes. */
export function polygonColshape(
  zone: Extract<ZoneShape, { type: "poly" }>,
): number | null {
  if (!hasColshapes() || zone.points.length < 3) return null;
  const id = CreateColshapePolygon(
    zone.minZ,
    zone.maxZ,
    zone.points.flatMap((p) => [p.x, p.y]),
  );
  return typeof id === "number" && Boolean(DoesColshapeExist(id)) ? id : null;
}

/** Deletes a colshape made by `polygonColshape` (nothing when it is gone). */
export function deleteColshape(id: number): void {
  if (hasColshapes() && Boolean(DoesColshapeExist(id))) DeleteColshape(id);
}
