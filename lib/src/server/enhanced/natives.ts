import { createLogger, VEHICLE_DAMAGE_MAX } from "../../shared";

export const log = createLogger(GetCurrentResourceName());

/**
 * Hashes of the FiveM for GTAV Enhanced server natives that are in neither @citizenfx/server nor Legacy's wrappers
 * (joaat of the upper-case name, from the native docs; `aicore-fivem` skill `references/enhanced.md`).
 */
export const HASH = {
  isWrecked: "0xA067F5AD", // IS_VEHICLE_WRECKED(Vehicle) -> BOOL
  wheels: "0xEDF4B0FC", // GET_VEHICLE_NUMBER_OF_WHEELS(Vehicle) -> int (owner reported)
  wheelOff: "0xCF1BC668", // IS_VEHICLE_WHEEL_BROKEN_OFF(Vehicle, int wheel) -> BOOL
  breakWheel: "0xA274CADB", // BREAK_OFF_VEHICLE_WHEEL(Vehicle, int wheel, BOOL, BOOL, BOOL, BOOL)
  allWindows: "0xBB619744", // ARE_ALL_VEHICLE_WINDOWS_INTACT(Vehicle) -> BOOL
  smashWindow: "0xDDD9A8C2", // SMASH_VEHICLE_WINDOW(Vehicle, int window)
  lightBroken: "0x7AFC9DF5", // IS_VEHICLE_LIGHT_BROKEN(Vehicle, int light) -> BOOL
  breakLight: "0x611A3234", // SET_VEHICLE_LIGHT_BROKEN(Vehicle, int light, BOOL broken)
  bumper: "0x67C9FAA3", // GET_VEHICLE_BUMPER_STATE(Vehicle, BOOL front) -> int
  setBumper: "0x4716182C", // SET_VEHICLE_BUMPER_STATE(Vehicle, BOOL front, int state)
  burstTyre: "0x89D28068", // SET_VEHICLE_TYRE_BURST(Vehicle, int wheel, BOOL onRim, float damage)
  fixTyre: "0xA42EFA6B", // SET_VEHICLE_TYRE_FIXED(Vehicle, int wheel)
  tank: "0x660A3692", // SET_VEHICLE_PETROL_TANK_HEALTH(Vehicle, float)
  engine: "0x1B760FB5", // SET_VEHICLE_ENGINE_HEALTH(Vehicle, float)
  fixed: "0x17469AA1", // SET_VEHICLE_FIXED(Vehicle): RPC to the owner client
  deformationFixed: "0xDD2920C8", // SET_VEHICLE_DEFORMATION_FIXED(Vehicle): RPC to the owner client
} as const;

type Arg = number | boolean;

/** FiveM's own wrappers pass floats like this: an integral number would arrive as an int. */
export const float = (v: number): number => (v === 0 ? v : v + 0.0000001);
/** A native answering BOOL, read as truthy: JS gets `1` / `0`, never `true` (`aicore-fivem` `engine.md`). */
export const bool = (hash: string, ...args: Arg[]): boolean =>
  Boolean(Citizen.invokeNative(hash, ...args, Citizen.returnResultAnyway()));
/** A native answering int. */
export const int = (hash: string, ...args: Arg[]): unknown =>
  Citizen.invokeNative(
    hash,
    ...args,
    Citizen.returnResultAnyway(),
    Citizen.resultAsInteger(),
  );
/** A native answering nothing. */
export const call = (hash: string, ...args: Arg[]): void =>
  Citizen.invokeNative(hash, ...args);

/** Runs one setter; a failure is logged and the next setter still runs. */
export function attempt(name: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    log.error(`enhanced native ${name} failed`, error);
  }
}

let vehicleNatives: boolean | undefined;
/**
 * The b177 server vehicle natives, probed once on an existing vehicle: a server without them throws on the unknown
 * hash (ai-voice's probe works the same way).
 */
export function hasVehicleNatives(vehicle: number): boolean {
  if (vehicleNatives === undefined && DoesEntityExist(vehicle)) {
    try {
      bool(HASH.isWrecked, vehicle);
      vehicleNatives = true;
    } catch {
      vehicleNatives = false;
    }
  }
  return vehicleNatives === true;
}

/** Synced wheel count, 0 while unknown (no owner client has sent the vehicle's data yet). */
export function wheelCount(vehicle: number): number {
  const n = int(HASH.wheels, vehicle);
  return typeof n === "number" && Number.isInteger(n)
    ? Math.min(VEHICLE_DAMAGE_MAX.wheel + 1, Math.max(0, n))
    : 0;
}
