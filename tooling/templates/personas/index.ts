import type { Persona } from "./persona";
import type { Template } from "@rezumi/schema/templates";
import { aksara } from "./aksara";
import { atlas } from "./atlas";
import { cendekia } from "./cendekia";
import { horizon } from "./horizon";
import { jejak } from "./jejak";
import { kirana } from "./kirana";
import { linen } from "./linen";
import { meridian } from "./meridian";
import { purnama } from "./purnama";
import { senja } from "./senja";
import { sterling } from "./sterling";
import { summit } from "./summit";
import { tenun } from "./tenun";
import { tunas } from "./tunas";
import { vector } from "./vector";
import { wibawa } from "./wibawa";

/** The gallery's fictional people, one per template. */
export const personas = {
	meridian,
	sterling,
	aksara,
	atlas,
	tunas,
	summit,
	cendekia,
	wibawa,
	tenun,
	vector,
	kirana,
	linen,
	horizon,
	jejak,
	purnama,
	senja,
} satisfies Record<Template, Persona>;
