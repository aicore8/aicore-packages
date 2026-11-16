import { createColshape, deleteColshape, onColshape } from "../fivem/colshape";
import { sleep } from "../shared";

/** How long a test shape waits for the local player's enter (FiveM samples every 50 ms). */
const WAIT_MS = 2000;
const TRIES = 6;

/** One test: a 50 m sphere around the player must report the player's own ped entering it. */
async function testOnce(): Promise<"yes" | "no" | "missing"> {
  const ped = PlayerPedId();
  if (!ped || !DoesEntityExist(ped)) return "no";
  const [x = 0, y = 0, z = 0] = GetEntityCoords(ped, false);
  const id = createColshape({
    type: "sphere",
    center: { x, y, z },
    radius: 50,
  });
  if (id === null) return "missing";
  const entered = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, WAIT_MS);
    const stop = onColshape(id, (entity, inside) => {
      if (!inside || entity !== PlayerPedId()) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
  });
  deleteColshape(id);
  return entered ? "yes" : "no";
}

/**
 * Whether colshapes work for the local player on this client: the natives exist and FiveM samples the player's ped
 * as a player (type 11). Tried a few times while the ped or its network object is not there yet (loading); false
 * means zones keep the script-side check.
 */
export async function colshapesWork(): Promise<boolean> {
  for (let i = 0; i < TRIES; i++) {
    const result = await testOnce();
    if (result !== "no") return result === "yes";
    await sleep(5000);
  }
  return false;
}
