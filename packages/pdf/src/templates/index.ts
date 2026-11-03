import type { TemplatePage } from "../document";
import type { Template } from "@rezumi/schema/templates";
import { AksaraPage } from "./aksara/AksaraPage";
import { AtlasPage } from "./atlas/AtlasPage";
import { AzurillPage } from "./azurill/AzurillPage";
import { BronzorPage } from "./bronzor/BronzorPage";
import { CendekiaPage } from "./cendekia/CendekiaPage";
import { ChikoritaPage } from "./chikorita/ChikoritaPage";
import { DitgarPage } from "./ditgar/DitgarPage";
import { DittoPage } from "./ditto/DittoPage";
import { GengarPage } from "./gengar/GengarPage";
import { GlaliePage } from "./glalie/GlaliePage";
import { HorizonPage } from "./horizon/HorizonPage";
import { JejakPage } from "./jejak/JejakPage";
import { KakunaPage } from "./kakuna/KakunaPage";
import { KiranaPage } from "./kirana/KiranaPage";
import { LaprasPage } from "./lapras/LaprasPage";
import { LeafishPage } from "./leafish/LeafishPage";
import { LinenPage } from "./linen/LinenPage";
import { MeowthPage } from "./meowth/MeowthPage";
import { MeridianPage } from "./meridian/MeridianPage";
import { OnyxPage } from "./onyx/OnyxPage";
import { PersianPage } from "./persian/PersianPage";
import { PikachuPage } from "./pikachu/PikachuPage";
import { PorygonPage } from "./porygon/PorygonPage";
import { PurnamaPage } from "./purnama/PurnamaPage";
import { RhyhornPage } from "./rhyhorn/RhyhornPage";
import { ScizorPage } from "./scizor/ScizorPage";
import { SenjaPage } from "./senja/SenjaPage";
import { SmearglePage } from "./smeargle/SmearglePage";
import { SterlingPage } from "./sterling/SterlingPage";
import { SummitPage } from "./summit/SummitPage";
import { TenunPage } from "./tenun/TenunPage";
import { TunasPage } from "./tunas/TunasPage";
import { VectorPage } from "./vector/VectorPage";
import { WibawaPage } from "./wibawa/WibawaPage";

const templatePages: Partial<Record<Template, TemplatePage>> = {
	azurill: AzurillPage,
	bronzor: BronzorPage,
	chikorita: ChikoritaPage,
	ditgar: DitgarPage,
	ditto: DittoPage,
	gengar: GengarPage,
	glalie: GlaliePage,
	kakuna: KakunaPage,
	lapras: LaprasPage,
	leafish: LeafishPage,
	meowth: MeowthPage,
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
	onyx: OnyxPage,
	persian: PersianPage,
	pikachu: PikachuPage,
	porygon: PorygonPage,
	rhyhorn: RhyhornPage,
	scizor: ScizorPage,
	smeargle: SmearglePage,
};

const defaultTemplatePage = AzurillPage;

export const getTemplatePage = (template: Template): TemplatePage => templatePages[template] ?? defaultTemplatePage;
