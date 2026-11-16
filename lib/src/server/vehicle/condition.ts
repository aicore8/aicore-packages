import type { VehicleDamage } from "../../shared";
import { readVehicleDamage } from "../enhanced/vehicle";
import { fuel } from "../fuel";

/** A vehicle's condition read on the server, in ai-vehicles' `SaveVehicle` shape. */
export interface VehicleCondition {
  engine: number;
  body: number;
  /** Through ai-core's fuel layer (any fuel script); left out when unknown. */
  fuel?: number;
  /** Windows, tyres, lights, bumpers, tank: FiveM for GTAV Enhanced only, and only while a client owns the vehicle. */
  damage?: VehicleDamage;
}

/** The condition to store with an owned vehicle that leaves the world (parked, impounded, listed, cleaned up). */
export function vehicleCondition(vehicle: number): VehicleCondition {
  const level = fuel.get(vehicle);
  const damage = readVehicleDamage(vehicle);
  return {
    engine: GetVehicleEngineHealth(vehicle),
    body: GetVehicleBodyHealth(vehicle),
    ...(level !== null ? { fuel: level } : {}),
    ...(damage ? { damage } : {}),
  };
}
