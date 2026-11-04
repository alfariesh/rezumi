import type { TemplatePage } from "../document";
import type { Template } from "@rezumi/schema/templates";
import { AksaraPage } from "./aksara/AksaraPage";
import { AtlasPage } from "./atlas/AtlasPage";
import { CendekiaPage } from "./cendekia/CendekiaPage";
import { HorizonPage } from "./horizon/HorizonPage";
import { JejakPage } from "./jejak/JejakPage";
import { KiranaPage } from "./kirana/KiranaPage";
import { LinenPage } from "./linen/LinenPage";
import { MeridianPage } from "./meridian/MeridianPage";
import { PurnamaPage } from "./purnama/PurnamaPage";
import { SenjaPage } from "./senja/SenjaPage";
import { SterlingPage } from "./sterling/SterlingPage";
import { SummitPage } from "./summit/SummitPage";
import { TenunPage } from "./tenun/TenunPage";
import { TunasPage } from "./tunas/TunasPage";
import { VectorPage } from "./vector/VectorPage";
import { WibawaPage } from "./wibawa/WibawaPage";

const templatePages: Record<Template, TemplatePage> = {
	meridian: MeridianPage,
	senja: SenjaPage,
	purnama: PurnamaPage,
	jejak: JejakPage,
	horizon: HorizonPage,
	linen: LinenPage,
	kirana: KiranaPage,
	vector: VectorPage,
	tenun: TenunPage,
	wibawa: WibawaPage,
	cendekia: CendekiaPage,
	summit: SummitPage,
	tunas: TunasPage,
	atlas: AtlasPage,
	aksara: AksaraPage,
	sterling: SterlingPage,
};

export const getTemplatePage = (template: Template): TemplatePage => templatePages[template];
