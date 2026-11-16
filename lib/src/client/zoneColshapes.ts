import { createColshape, deleteColshape, onColshape } from "../fivem/colshape";
import { createLogger, sleep } from "../shared";
import { zoneContains } from "../shared/zone";
import { onCache } from "./cache";
import { colshapesWork } from "./colshapeCheck";
import type { Zone } from "./zoneGrid";

const log = createLogger(GetCurrentResourceName());

/** Delay of the one position check after a zone gets its colshape or the ped changes. */
const SETTLE_MS = 250;
/** Zones moved onto colshapes per tick at the hand-over (about 15 natives each). */
const CHUNK = 500;

/**
 * The colshape side of a `ZoneEngine`: zones as FiveM colshapes once a live test passed. FiveM reports only the
 * changes it saw itself, so a zone is checked once against the player's position after its colshape is made (a
 * seeded or handed-over state, an event still queued for the id's previous shape) and after a ped change. A zone's
 * `interval` stays the shortest gap between two of its enter / exit calls.
 */
export class ColshapeZones {
  /** Colshapes passed the live test. */
  active = false;
  private readonly attached = new Set<Zone>();
  private lastPed = 0;

  constructor(
    private readonly setInside: (zone: Zone, inside: boolean) => void,
  ) {}

  /** Runs the live test; on a pass moves the script-checked zones (`filed()` then) over, calling `moved` for each. */
  async start(filed: () => Zone[], moved: (zone: Zone) => void): Promise<void> {
    if (!(await colshapesWork())) {
      log.warn("zones: colshapes unavailable, script check kept");
      return;
    }
    this.active = true;
    this.lastPed = PlayerPedId();
    // The new ped's handle is noticed at the next colshape event too (the old ped exits every shape as it goes).
    onCache("ped", () => this.pedChanged());
    const zones = filed();
    for (let i = 0; i < zones.length; i += CHUNK) {
      if (i > 0) await sleep(0);
      for (const zone of zones.slice(i, i + CHUNK))
        if (zone.filed && this.attach(zone)) moved(zone);
    }
  }

  /** The zone as a colshape; false when it stays on the script check. */
  attach(zone: Zone): boolean {
    if (!this.active) return false;
    const id = createColshape(zone.options.shape);
    if (id === null) return false;
    zone.colshape = id;
    zone.unsubscribe = onColshape(id, (entity, inside) =>
      this.event(zone, entity, inside),
    );
    this.attached.add(zone);
    this.recheck(zone, SETTLE_MS);
    return true;
  }

  detach(zone: Zone): void {
    if (zone.colshape === null) return;
    zone.unsubscribe?.();
    deleteColshape(zone.colshape);
    if (zone.recheck !== null) clearTimeout(zone.recheck);
    zone.colshape = null;
    zone.unsubscribe = null;
    zone.recheck = null;
    this.attached.delete(zone);
  }

  private event(zone: Zone, entity: number, inside: boolean): void {
    const ped = PlayerPedId();
    if (ped !== this.lastPed) this.pedChanged();
    if (entity !== ped || inside === zone.inside) return;
    const wait = zone.lastFire + zone.interval - GetGameTimer();
    if (wait > 0) this.recheck(zone, wait);
    else this.setInside(zone, inside);
  }

  private pedChanged(): void {
    this.lastPed = PlayerPedId();
    for (const zone of this.attached) this.recheck(zone, SETTLE_MS);
  }

  /** One position check of the zone after `ms` (an earlier pending one stands). */
  private recheck(zone: Zone, ms: number): void {
    if (zone.recheck !== null) return;
    zone.recheck = setTimeout(() => {
      zone.recheck = null;
      if (zone.colshape === null) return;
      const [x = 0, y = 0, z = 0] = GetEntityCoords(PlayerPedId(), false);
      this.setInside(zone, zoneContains(zone.options.shape, x, y, z));
    }, ms);
  }
}
