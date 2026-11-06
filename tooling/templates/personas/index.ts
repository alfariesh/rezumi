import type { Persona } from "./persona";
import type { Template } from "@rezumi/schema/templates";
import { aksara } from "./aksara";
import { anggrek } from "./anggrek";
import { atlas } from "./atlas";
import { awan } from "./awan";
import { bingkai } from "./bingkai";
import { cahaya } from "./cahaya";
import { cendekia } from "./cendekia";
import { cerah } from "./cerah";
import { cobalt } from "./cobalt";
import { fajar } from "./fajar";
import { graphite } from "./graphite";
import { horizon } from "./horizon";
import { ivory } from "./ivory";
import { jejak } from "./jejak";
import { kirana } from "./kirana";
import { kontras } from "./kontras";
import { linen } from "./linen";
import { lintasan } from "./lintasan";
import { marquee } from "./marquee";
import { menara } from "./menara";
import { meridian } from "./meridian";
import { mozaik } from "./mozaik";
import { nusa } from "./nusa";
import { pilar } from "./pilar";
import { purnama } from "./purnama";
import { sekar } from "./sekar";
import { selaras } from "./selaras";
import { senja } from "./senja";
import { sterling } from "./sterling";
import { summit } from "./summit";
import { tenun } from "./tenun";
import { tepi } from "./tepi";
import { teras } from "./teras";
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
	anggrek,
	ivory,
	pilar,
	bingkai,
	cerah,
	mozaik,
	nusa,
	selaras,
	teras,
	cobalt,
	kontras,
	lintasan,
	graphite,
	awan,
	menara,
	tepi,
	sekar,
	marquee,
	fajar,
	cahaya,
} satisfies Record<Template, Persona>;
