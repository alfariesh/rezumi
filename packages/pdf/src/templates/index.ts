import type { TemplatePage } from "../document";
import type { Template } from "@rezumi/schema/templates";
import { AksaraPage } from "./aksara/AksaraPage";
import { AnggrekPage } from "./anggrek/AnggrekPage";
import { AtlasPage } from "./atlas/AtlasPage";
import { AwanPage } from "./awan/AwanPage";
import { BingkaiPage } from "./bingkai/BingkaiPage";
import { CahayaPage } from "./cahaya/CahayaPage";
import { CendekiaPage } from "./cendekia/CendekiaPage";
import { CerahPage } from "./cerah/CerahPage";
import { CobaltPage } from "./cobalt/CobaltPage";
import { FajarPage } from "./fajar/FajarPage";
import { GraphitePage } from "./graphite/GraphitePage";
import { HorizonPage } from "./horizon/HorizonPage";
import { IvoryPage } from "./ivory/IvoryPage";
import { JejakPage } from "./jejak/JejakPage";
import { KiranaPage } from "./kirana/KiranaPage";
import { KontrasPage } from "./kontras/KontrasPage";
import { LinenPage } from "./linen/LinenPage";
import { LintasanPage } from "./lintasan/LintasanPage";
import { MarqueePage } from "./marquee/MarqueePage";
import { MenaraPage } from "./menara/MenaraPage";
import { MeridianPage } from "./meridian/MeridianPage";
import { MozaikPage } from "./mozaik/MozaikPage";
import { NusaPage } from "./nusa/NusaPage";
import { PilarPage } from "./pilar/PilarPage";
import { PurnamaPage } from "./purnama/PurnamaPage";
import { SekarPage } from "./sekar/SekarPage";
import { SelarasPage } from "./selaras/SelarasPage";
import { SenjaPage } from "./senja/SenjaPage";
import { SterlingPage } from "./sterling/SterlingPage";
import { SummitPage } from "./summit/SummitPage";
import { TenunPage } from "./tenun/TenunPage";
import { TepiPage } from "./tepi/TepiPage";
import { TerasPage } from "./teras/TerasPage";
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
	anggrek: AnggrekPage,
	ivory: IvoryPage,
	pilar: PilarPage,
	bingkai: BingkaiPage,
	cerah: CerahPage,
	mozaik: MozaikPage,
	nusa: NusaPage,
	selaras: SelarasPage,
	teras: TerasPage,
	cobalt: CobaltPage,
	kontras: KontrasPage,
	lintasan: LintasanPage,
	graphite: GraphitePage,
	awan: AwanPage,
	menara: MenaraPage,
	tepi: TepiPage,
	sekar: SekarPage,
	marquee: MarqueePage,
	fajar: FajarPage,
	cahaya: CahayaPage,
};

export const getTemplatePage = (template: Template): TemplatePage => templatePages[template];
