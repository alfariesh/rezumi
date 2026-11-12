import { LUGAS_CSS } from "../lugas/css";

/** Warta's rules. Phase 13 stub: Lugas' rules under `data-theme="warta"` until `pf-themes` writes the theme's own. */
export const WARTA_CSS = LUGAS_CSS.replaceAll('data-theme="lugas"', 'data-theme="warta"');
