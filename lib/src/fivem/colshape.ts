import { createLogger } from "../shared";
import type { ZoneShape } from "../shared/zone";

/**
 * FiveM colshapes on both sides: shapes kept by FiveM itself (one BVH for every resource, entities sampled at 20 Hz,
 * the test on a worker thread) that raise `onColshapeEnter` / `onColshapeExit(entity, id)`. Documented for Enhanced,
 * backported to Legacy and RedM (citizenfx/fivem "feat(natives): backport colshape natives to legacy + rdr3",
 * 2026-07-23). A resource's shapes are deleted when it stops.
 */

const log = createLogger(GetCurrentResourceName());

/** GTA V `NetObjEntityType` (citizenfx/fivem `code/shared/net/NetObjEntityType.h`): 0 automobile ... 13 train. */
const ENTITY_TYPES = 14;
/** A player's ped (`CNetObjPlayer`). */
const PLAYER_TYPE = 11;

let available: boolean | undefined;

/** Whether this build has colshapes: a test shape must exist after it is created (probed once). */
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

/**
 * A lib `ZoneShape` as a colshape that only players' peds trigger; null without colshapes or when FiveM refuses
 * it (its ids are shared by every resource): the caller keeps its own check then.
 */
export function createColshape(shape: ZoneShape): number | null {
  if (!hasColshapes()) return null;
  let id: unknown;
  try {
    switch (shape.type) {
      case "sphere":
        id = CreateColshapeSphere(
          shape.center.x,
          shape.center.y,
          shape.center.z,
          shape.radius,
        );
        break;
      case "cylinder":
        // Ours reaches `height` up and down from the centre; FiveM's height is the whole cylinder.
        id = CreateColshapeCylinder(
          shape.center.x,
          shape.center.y,
          shape.center.z,
          shape.radius,
          shape.height * 2,
        );
        break;
      case "poly":
        if (shape.points.length < 3) return null;
        id = CreateColshapePolygon(
          shape.minZ,
          shape.maxZ,
          shape.points.flatMap((p) => [p.x, p.y]),
        );
        break;
    }
    if (typeof id !== "number" || id < 0 || !DoesColshapeExist(id)) return null;
    for (let type = 0; type < ENTITY_TYPES; type++)
      if (type !== PLAYER_TYPE) SetColshapeEntityType(id, type, false);
    return id;
  } catch (error) {
    log.error("colshape could not be created", error);
    return null;
  }
}

/** Deletes a colshape (nothing when it is gone). No exit event follows: the owner handles its own state. */
export function deleteColshape(id: number): void {
  if (hasColshapes() && DoesColshapeExist(id)) DeleteColshape(id);
}

type ColshapeHandler = (entity: number, inside: boolean) => void;
const handlers = new Map<number, ColshapeHandler>();
let listening = false;

function dispatch(entity: number, id: number, inside: boolean): void {
  const handler = handlers.get(id);
  if (!handler) return;
  try {
    handler(entity, inside);
  } catch (error) {
    log.error("colshape handler failed", error);
  }
}

/**
 * Enter (`inside` true) and exit of one colshape, through one listener per resource. Every resource receives every
 * colshape event, so only one place per side should listen for many shapes. Returns the unsubscribe.
 */
export function onColshape(id: number, handler: ColshapeHandler): () => void {
  if (!listening) {
    listening = true;
    on("onColshapeEnter", (entity: number, shape: number) =>
      dispatch(entity, shape, true),
    );
    on("onColshapeExit", (entity: number, shape: number) =>
      dispatch(entity, shape, false),
    );
  }
  handlers.set(id, handler);
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id);
  };
}
