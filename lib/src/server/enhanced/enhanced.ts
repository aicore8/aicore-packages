import {
  applyVehicleDamage,
  readVehicleDamage,
  repairVehicle,
  restoreVehicleDamage,
  setVehicleEngineHealth,
} from "./vehicle";

/**
 * Server features only FiveM for GTAV Enhanced has (patch notes and native docs, `aicore-fivem` skill
 * `references/enhanced.md`). Each feature is probed; without it every helper answers null / false and the caller
 * keeps its own path. Scripts never call these natives by hash themselves. (Colshapes are on Legacy too:
 * `createColshape` in the fivem layer.)
 */
export const enhanced = {
  readVehicleDamage,
  applyVehicleDamage,
  restoreVehicleDamage,
  repairVehicle,
  setVehicleEngineHealth,
};
