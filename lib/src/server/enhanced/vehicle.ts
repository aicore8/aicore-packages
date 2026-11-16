import {
  readBumperState,
  VEHICLE_DAMAGE_MAX,
  waitFor,
  type VehicleDamage,
} from "../../shared";
import {
  attempt,
  bool,
  call,
  float,
  HASH,
  hasVehicleNatives,
  int,
  log,
  wheelCount,
} from "./natives";

/** Lowest petrol tank health restored: a tank at or below 0 can burn the car at a garage spot. */
const TANK_FLOOR = 100;

let readFailed = false;

/**
 * A per-wheel native that may refuse an index. Tyre and wheel indexes are GTA's (0 LF, 1 RF, 2 LM, 3 RM, 4 LR, 5 RR,
 * ...: a car's rear tyres are 4 and 5) or the synced wheel order; the docs do not say which, so every index up to
 * `VEHICLE_DAMAGE_MAX.wheel` is walked and a refused one counts as intact.
 */
function wheelSafe(fn: () => unknown): boolean {
  try {
    return Boolean(fn());
  } catch {
    return false;
  }
}

/**
 * The damage of a vehicle a client owns and has synced (windows, tyres, wheels, lights, bumpers, petrol tank), read on
 * the server. Null on Legacy, before the owner's first sync (the server's vehicle data is empty then) or when a native
 * fails (logged once): the caller keeps what it had.
 */
export function readVehicleDamage(vehicle: number): VehicleDamage | null {
  if (
    !DoesEntityExist(vehicle) ||
    NetworkGetEntityOwner(vehicle) <= 0 ||
    !hasVehicleNatives(vehicle)
  )
    return null;
  try {
    // 0 until the owner's first sync: nothing to read yet.
    if (wheelCount(vehicle) === 0) return null;
    const windows: number[] = [];
    if (!bool(HASH.allWindows, vehicle))
      for (let i = 0; i <= VEHICLE_DAMAGE_MAX.window; i++)
        if (!IsVehicleWindowIntact(vehicle, i)) windows.push(i);
    const tyres: Array<[number, boolean]> = [];
    const wheelsOff: number[] = [];
    for (let i = 0; i <= VEHICLE_DAMAGE_MAX.wheel; i++) {
      if (wheelSafe(() => bool(HASH.wheelOff, vehicle, i))) wheelsOff.push(i);
      else if (wheelSafe(() => IsVehicleTyreBurst(vehicle, i, false)))
        tyres.push([i, wheelSafe(() => IsVehicleTyreBurst(vehicle, i, true))]);
    }
    const lights: number[] = [];
    for (let i = 0; i <= VEHICLE_DAMAGE_MAX.light; i++)
      if (bool(HASH.lightBroken, vehicle, i)) lights.push(i);
    const tank = GetVehiclePetrolTankHealth(vehicle);
    return {
      v: 1,
      windows,
      tyres,
      wheelsOff,
      lights,
      bumpers: [
        readBumperState(int(HASH.bumper, vehicle, true)) ?? 0,
        readBumperState(int(HASH.bumper, vehicle, false)) ?? 0,
      ],
      tank: Number.isFinite(tank) ? tank : 1000,
    };
  } catch (error) {
    if (!readFailed) log.error("enhanced vehicle damage read failed", error);
    readFailed = true;
    return null;
  }
}

/** Writes stored damage to the synced vehicle data; false on Legacy. */
export function applyVehicleDamage(
  vehicle: number,
  damage: VehicleDamage,
): boolean {
  if (!DoesEntityExist(vehicle) || !hasVehicleNatives(vehicle)) return false;
  for (const i of damage.windows)
    attempt("SMASH_VEHICLE_WINDOW", () => call(HASH.smashWindow, vehicle, i));
  for (const i of damage.wheelsOff)
    attempt("BREAK_OFF_VEHICLE_WHEEL", () =>
      call(HASH.breakWheel, vehicle, i, false, true, false, false),
    );
  for (const [i, onRim] of damage.tyres)
    attempt("SET_VEHICLE_TYRE_BURST", () =>
      call(HASH.burstTyre, vehicle, i, onRim, float(1000)),
    );
  for (const i of damage.lights)
    attempt("SET_VEHICLE_LIGHT_BROKEN", () =>
      call(HASH.breakLight, vehicle, i, true),
    );
  damage.bumpers.forEach((state, i) => {
    if (state > 0)
      attempt("SET_VEHICLE_BUMPER_STATE", () =>
        call(HASH.setBumper, vehicle, i === 0, state),
      );
  });
  if (damage.tank < 1000)
    attempt("SET_VEHICLE_PETROL_TANK_HEALTH", () =>
      call(HASH.tank, vehicle, float(Math.max(TANK_FLOOR, damage.tank))),
    );
  return true;
}

/**
 * Restores stored damage on a new entity once its owner client has synced it (a write before that is overwritten
 * by the client's first sync); gives up after 10 s, when the entity is gone or when `same()` says the handle is no
 * longer that vehicle. Resolves whether it was applied (false on Legacy).
 */
export async function restoreVehicleDamage(
  vehicle: number,
  damage: VehicleDamage,
  same: () => boolean = () => true,
): Promise<boolean> {
  const until = (ready: () => boolean): Promise<boolean> =>
    waitFor(
      () =>
        !DoesEntityExist(vehicle) || !same() ? false : ready() || undefined,
      10_000,
      250,
    ).catch(() => false);
  // The probe runs on an owned vehicle, like every read.
  if (!(await until(() => NetworkGetEntityOwner(vehicle) > 0))) return false;
  if (!hasVehicleNatives(vehicle)) return false;
  if (!(await until(() => wheelCount(vehicle) > 0))) return false;
  return applyVehicleDamage(vehicle, damage);
}

/**
 * A full repair from the server: deformation, windows, lights, bumpers, tyres, engine, body and petrol tank. The
 * health values are written to the synced data (no owner client needed); `SET_VEHICLE_FIXED` and the deformation go
 * to the owner client. False on Legacy.
 */
export function repairVehicle(vehicle: number): boolean {
  if (!DoesEntityExist(vehicle) || !hasVehicleNatives(vehicle)) return false;
  attempt("SET_VEHICLE_FIXED", () => call(HASH.fixed, vehicle));
  attempt("SET_VEHICLE_DEFORMATION_FIXED", () =>
    call(HASH.deformationFixed, vehicle),
  );
  attempt("SET_VEHICLE_ENGINE_HEALTH", () =>
    call(HASH.engine, vehicle, float(1000)),
  );
  attempt("SET_VEHICLE_PETROL_TANK_HEALTH", () =>
    call(HASH.tank, vehicle, float(1000)),
  );
  attempt("SET_VEHICLE_BODY_HEALTH", () => SetVehicleBodyHealth(vehicle, 1000));
  // Every index (see `wheelSafe`); SET_VEHICLE_FIXED repairs them on the owner client too.
  for (let i = 0; i <= VEHICLE_DAMAGE_MAX.wheel; i++)
    wheelSafe(() => call(HASH.fixTyre, vehicle, i));
  return true;
}

/** Engine health written to the synced data from the server (no owner client needed); false on Legacy. */
export function setVehicleEngineHealth(
  vehicle: number,
  health: number,
): boolean {
  if (!DoesEntityExist(vehicle) || !hasVehicleNatives(vehicle)) return false;
  attempt("SET_VEHICLE_ENGINE_HEALTH", () =>
    call(HASH.engine, vehicle, float(health)),
  );
  return true;
}
