import { isRecord } from "./record";

/**
 * A vehicle's damage beyond engine and body health, as plain data: read and restored by the server on FiveM for GTAV
 * Enhanced (lib server `enhanced`). Stored JSON carries `v: 1`.
 */
export interface VehicleDamage {
  v: 1;
  /** Smashed windows: 0 front left, 1 front right, 2 rear left, 3 rear right, 4 middle left, 5 middle right, 6 windscreen, 7 rear windscreen. */
  windows: number[];
  /** Burst tyres by synced wheel index, `true` when it runs on the rim. */
  tyres: Array<[wheel: number, onRim: boolean]>;
  /** Broken off wheels by synced wheel index. */
  wheelsOff: number[];
  /** Broken lights, 0-21 (`SET_VEHICLE_LIGHT_BROKEN`: headlights 0-1, taillights 2-3, indicators 4-7, ...). */
  lights: number[];
  /** Front and rear bumper: 0 intact, 1 hanging loose, 2 broken off. */
  bumpers: [front: number, rear: number];
  /** Petrol tank health, 1000 undamaged. */
  tank: number;
}

/** Highest index kept of each part: the server reader walks the same ranges. */
export const VEHICLE_DAMAGE_MAX = {
  window: 7,
  light: 21,
  /** Synced wheel index (a vehicle has at most 10 wheels). */
  wheel: 15,
} as const;
const MAX_WHEEL = VEHICLE_DAMAGE_MAX.wheel;

const indexes = (v: unknown, max: number): number[] | null =>
  Array.isArray(v) &&
  v.length <= max + 1 &&
  v.every((x) => Number.isInteger(x) && x >= 0 && x <= max)
    ? [...new Set(v as number[])]
    : null;

/** A bumper state (0 intact, 1 loose, 2 off), null when it is not one. */
export const readBumperState = (v: unknown): number | null =>
  v === 0 || v === 1 || v === 2 ? v : null;

/** Stored damage, checked; null when the shape is not ours. */
export function toVehicleDamage(v: unknown): VehicleDamage | null {
  if (!isRecord(v) || v.v !== 1) return null;
  const windows = indexes(v.windows, VEHICLE_DAMAGE_MAX.window);
  const wheelsOff = indexes(v.wheelsOff, MAX_WHEEL);
  const lights = indexes(v.lights, VEHICLE_DAMAGE_MAX.light);
  const front = Array.isArray(v.bumpers) ? readBumperState(v.bumpers[0]) : null;
  const rear = Array.isArray(v.bumpers) ? readBumperState(v.bumpers[1]) : null;
  if (
    !windows ||
    !wheelsOff ||
    !lights ||
    front === null ||
    rear === null ||
    typeof v.tank !== "number" ||
    !Number.isFinite(v.tank) ||
    !Array.isArray(v.tyres) ||
    v.tyres.length > MAX_WHEEL + 1
  )
    return null;
  const tyres: Array<[number, boolean]> = [];
  for (const t of v.tyres) {
    if (
      !Array.isArray(t) ||
      !Number.isInteger(t[0]) ||
      t[0] < 0 ||
      t[0] > MAX_WHEEL ||
      typeof t[1] !== "boolean"
    )
      return null;
    tyres.push([t[0] as number, t[1]]);
  }
  return {
    v: 1,
    windows,
    tyres,
    wheelsOff,
    lights,
    bumpers: [front, rear],
    tank: Math.min(1000, Math.max(-1000, v.tank)),
  };
}
