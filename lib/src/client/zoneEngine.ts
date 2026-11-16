import { every, type Job } from "../fivem/scheduler/every";
import { createLogger } from "../shared";
import { zoneContains } from "../shared/zone";
import { cache } from "./cache";
import { ColshapeZones } from "./zoneColshapes";
import { Zone, ZoneGrid, type ZoneOptions } from "./zoneGrid";

export type { ZoneOptions };

/**
 * The zone checker. With `colshapes` (ai-lib's checker only) each zone becomes a FiveM colshape once a live test
 * passed (`zoneColshapes.ts`): FiveM tests every shape at 20 Hz on a worker thread and JS sees only enter / exit
 * events (every player's ped, filtered here to the local one). Otherwise, and for
 * a zone FiveM refuses, the script check: each zone at its own interval, never per frame, in a grid of 64 m cells
 * (measured with 1,000,000 zones). ai-lib runs one for every resource's zones (`zones.ts`); a resource runs its own
 * only while ai-lib does not.
 */

const log = createLogger(GetCurrentResourceName());

export interface ZoneEngineOptions {
  /** Zones as FiveM colshapes after a live test. Every resource listening for colshape events gets all of them: one engine per client. */
  colshapes?: boolean;
}

/**
 * A set of zones. One scheduler job serves the script-checked ones at the shortest interval any of them asks for;
 * each zone is checked only when its own interval has passed. With none of them the job stops.
 */
export class ZoneEngine {
  private readonly zones = new Map<string, Zone>();
  private readonly grid = new ZoneGrid();
  private readonly insideNow = new Set<Zone>();
  private job: Job | null = null;
  private period = 0;
  private readonly colshapes = new ColshapeZones((zone, inside) =>
    this.setInside(zone, inside),
  );

  constructor(options: ZoneEngineOptions = {}) {
    if (!options.colshapes) return;
    void this.colshapes.start(
      () => [...this.zones.values()].filter((zone) => zone.filed),
      (zone) => {
        this.grid.unfile(zone);
        this.schedule();
      },
    );
  }

  /**
   * Adds (or replaces) a zone. A replaced zone the player was in fires its onExit first. `inside` seeds the state of a
   * zone handed over from another checker, so leaving it is noticed and staying in it fires nothing.
   */
  add(id: string, options: ZoneOptions, inside = false): void {
    this.remove(id);
    const zone = new Zone(options, inside);
    this.zones.set(id, zone);
    if (inside) this.insideNow.add(zone);
    if (this.colshapes.attach(zone)) return;
    this.grid.file(zone);
    this.schedule();
  }

  /** Removes a zone; it fires onExit when the player was in it, unless `quiet` (a hand-over). */
  remove(id: string, quiet = false): void {
    const zone = this.zones.get(id);
    if (!zone) return;
    this.zones.delete(id);
    this.colshapes.detach(zone);
    if (this.grid.unfile(zone)) this.schedule();
    if (this.insideNow.delete(zone) && !quiet) this.fire(zone, false);
  }

  /** Removes every zone (exits fire for the ones the player is in). */
  clear(): void {
    const inside = [...this.insideNow];
    for (const zone of this.zones.values()) this.colshapes.detach(zone);
    this.zones.clear();
    this.grid.clear();
    this.insideNow.clear();
    for (const zone of inside) this.fire(zone, false);
    this.schedule();
  }

  isInside(id: string): boolean {
    return this.zones.get(id)?.inside ?? false;
  }

  get size(): number {
    return this.zones.size;
  }

  private schedule(): void {
    const period = this.grid.shortestInterval();
    if (period === this.period) return;
    this.job?.stop();
    this.job = period
      ? every(period, () => this.check(), { name: "zones" })
      : null;
    this.period = period;
  }

  private check(): void {
    const now = GetGameTimer();
    const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
    // The zones the player is in go first, so leaving one is noticed wherever the player went.
    for (const zone of this.insideNow)
      if (zone.filed) this.test(zone, now, x, y, z);
    this.grid.forNear(x, y, (zone) => this.test(zone, now, x, y, z));
  }

  private test(zone: Zone, now: number, x: number, y: number, z: number): void {
    if (now < zone.nextCheck) return;
    zone.nextCheck = now + zone.interval;
    this.setInside(zone, zoneContains(zone.options.shape, x, y, z));
  }

  private setInside(zone: Zone, inside: boolean): void {
    if (inside === zone.inside) return;
    if (inside) this.insideNow.add(zone);
    else this.insideNow.delete(zone);
    this.fire(zone, inside);
  }

  private fire(zone: Zone, inside: boolean): void {
    zone.inside = inside;
    zone.lastFire = GetGameTimer();
    // A failing enter / exit handler must not stop the other zones.
    try {
      if (inside) zone.options.onEnter?.();
      else zone.options.onExit?.();
    } catch (error) {
      log.error("zone handler failed", error);
    }
  }
}
