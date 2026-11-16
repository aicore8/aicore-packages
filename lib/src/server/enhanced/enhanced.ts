import { deleteColshape, hasColshapes, polygonColshape } from "./colshape";
import {
  applyVehicleDamage,
  countVehicleDamage,
  readVehicleDamage,
  repairVehicle,
  restoreVehicleDamage,
  setVehicleEngineHealth,
} from "./vehicle";

/**
 * Server features only FiveM for GTAV Enhanced has (patch notes and native docs, `aicore-fivem` skill
 * `references/enhanced.md`). Each feature is probed once; on Legacy every helper answers null / false and the caller
 * keeps its own path. Scripts never call these natives by hash themselves.
 */
export const enhanced = {
  hasColshapes,
  polygonColshape,
  deleteColshape,
  readVehicleDamage,
  countVehicleDamage,
  applyVehicleDamage,
  restoreVehicleDamage,
  repairVehicle,
  setVehicleEngineHealth,
};
