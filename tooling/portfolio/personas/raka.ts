import type { PersonaDefinition } from "../persona";
import { nadia } from "./nadia";

/** Sintaks: Raka, a backend engineer in Yogyakarta. Phase 13 stub: Nadia's content until `pf-themes` writes Raka's. */
export const raka: PersonaDefinition = { ...nadia, id: "raka", theme: "sintaks", username: "raka" };
