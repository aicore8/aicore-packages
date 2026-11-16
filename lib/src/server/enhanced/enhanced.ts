import { deleteColshape, hasColshapes, polygonColshape } from "./colshape";
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
 * keeps its own path. Colshapes are documented for Enhanced but Legacy artifacts ship them too: their probe decides. Scripts never call these natives by hash themselves.
 */
export const enhanced = {
  hasColshapes,
  polygonColshape,
  deleteColshape,
  readVehicleDamage,
  applyVehicleDamage,
  restoreVehicleDamage,
  repairVehicle,
  setVehicleEngineHealth,
};
