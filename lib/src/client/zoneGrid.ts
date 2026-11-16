import { zoneBounds, type ZoneShape } from "../shared/zone";

export interface ZoneOptions {
  shape: ZoneShape;
  /** How often the script check runs, in ms (default 500, at least 50). A colshape is tested every 50 ms. */
  interval?: number;
  onEnter?: () => void;
  onExit?: () => void;
}

export class Zone {
  inside = false;
  nextCheck = 0;
  readonly interval: number;
  /** Grid cells the zone is filed under (`ZoneGrid`). */
  readonly cells: number[] = [];
  /** Filed for the script check. */
  filed = false;
  colshape: number | null = null;
  unsubscribe: (() => void) | null = null;

  constructor(
    readonly options: ZoneOptions,
    inside: boolean,
  ) {
    this.interval = Math.max(50, options.interval ?? 500);
    this.inside = inside;
  }
}

const CELL = 64;
/** A zone wider than this many cells is kept in one list checked every time instead of in the grid. */
const MAX_CELLS = 64;
const cellKey = (cx: number, cy: number): number =>
  ((cx + 32768) << 16) | (cy + 32768);

/** The script-checked zones of a `ZoneEngine`: a grid of 64 m cells, a list of very large zones, and their intervals. */
export class ZoneGrid {
  private readonly cells = new Map<number, Set<Zone>>();
  private readonly large = new Set<Zone>();
  /** How many zones use each interval, so the shortest one is found without walking every zone. */
  private readonly intervals = new Map<number, number>();

  file(zone: Zone): void {
    zone.filed = true;
    const [minX, minY, maxX, maxY] = zoneBounds(zone.options.shape);
    const x0 = Math.floor(minX / CELL);
    const y0 = Math.floor(minY / CELL);
    const x1 = Math.floor(maxX / CELL);
    const y1 = Math.floor(maxY / CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) this.large.add(zone);
    else {
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = cellKey(cx, cy);
          let cell = this.cells.get(key);
          if (!cell) this.cells.set(key, (cell = new Set()));
          cell.add(zone);
          zone.cells.push(key);
        }
      }
    }
    this.intervals.set(
      zone.interval,
      (this.intervals.get(zone.interval) ?? 0) + 1,
    );
  }

  /** Takes a zone out; false when it was not filed. */
  unfile(zone: Zone): boolean {
    if (!zone.filed) return false;
    zone.filed = false;
    this.large.delete(zone);
    for (const key of zone.cells) {
      const cell = this.cells.get(key);
      cell?.delete(zone);
      if (cell?.size === 0) this.cells.delete(key);
    }
    zone.cells.length = 0;
    const left = (this.intervals.get(zone.interval) ?? 1) - 1;
    if (left > 0) this.intervals.set(zone.interval, left);
    else this.intervals.delete(zone.interval);
    return true;
  }

  clear(): void {
    this.cells.clear();
    this.large.clear();
    this.intervals.clear();
  }

  /** The shortest interval of the filed zones, 0 with none. */
  shortestInterval(): number {
    let period = 0;
    for (const interval of this.intervals.keys())
      period = period === 0 ? interval : Math.min(period, interval);
    return period;
  }

  /** Runs `fn` for the zones that may contain a point: the large ones and the point's cell. */
  forNear(x: number, y: number, fn: (zone: Zone) => void): void {
    for (const zone of this.large) fn(zone);
    const cell = this.cells.get(
      cellKey(Math.floor(x / CELL), Math.floor(y / CELL)),
    );
    if (cell) for (const zone of cell) fn(zone);
  }
}
