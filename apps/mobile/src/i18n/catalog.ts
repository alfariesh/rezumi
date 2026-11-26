import type { Messages } from "@lingui/core";
import type { Locale } from "@rezumi/utils/locale";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";

// Metro registers the assets statically. Only the chosen locale is read and parsed.
const catalogs: Record<Locale, () => number> = {
	"af-ZA": () => require("../../.cache/lingui/af-ZA.l10n"),
	"am-ET": () => require("../../.cache/lingui/am-ET.l10n"),
	"ar-SA": () => require("../../.cache/lingui/ar-SA.l10n"),
	"az-AZ": () => require("../../.cache/lingui/az-AZ.l10n"),
	"bg-BG": () => require("../../.cache/lingui/bg-BG.l10n"),
	"bn-BD": () => require("../../.cache/lingui/bn-BD.l10n"),
	"ca-ES": () => require("../../.cache/lingui/ca-ES.l10n"),
	"cs-CZ": () => require("../../.cache/lingui/cs-CZ.l10n"),
	"da-DK": () => require("../../.cache/lingui/da-DK.l10n"),
	"de-DE": () => require("../../.cache/lingui/de-DE.l10n"),
	"el-GR": () => require("../../.cache/lingui/el-GR.l10n"),
	"en-US": () => require("../../.cache/lingui/en-US.l10n"),
	"en-GB": () => require("../../.cache/lingui/en-GB.l10n"),
	"es-ES": () => require("../../.cache/lingui/es-ES.l10n"),
	"fa-IR": () => require("../../.cache/lingui/fa-IR.l10n"),
	"fi-FI": () => require("../../.cache/lingui/fi-FI.l10n"),
	"fr-FR": () => require("../../.cache/lingui/fr-FR.l10n"),
	"he-IL": () => require("../../.cache/lingui/he-IL.l10n"),
	"hi-IN": () => require("../../.cache/lingui/hi-IN.l10n"),
	"hu-HU": () => require("../../.cache/lingui/hu-HU.l10n"),
	"id-ID": () => require("../../.cache/lingui/id-ID.l10n"),
	"it-IT": () => require("../../.cache/lingui/it-IT.l10n"),
	"ja-JP": () => require("../../.cache/lingui/ja-JP.l10n"),
	"km-KH": () => require("../../.cache/lingui/km-KH.l10n"),
	"kn-IN": () => require("../../.cache/lingui/kn-IN.l10n"),
	"ko-KR": () => require("../../.cache/lingui/ko-KR.l10n"),
	"lt-LT": () => require("../../.cache/lingui/lt-LT.l10n"),
	"lv-LV": () => require("../../.cache/lingui/lv-LV.l10n"),
	"ml-IN": () => require("../../.cache/lingui/ml-IN.l10n"),
	"mr-IN": () => require("../../.cache/lingui/mr-IN.l10n"),
	"ms-MY": () => require("../../.cache/lingui/ms-MY.l10n"),
	"ne-NP": () => require("../../.cache/lingui/ne-NP.l10n"),
	"nl-NL": () => require("../../.cache/lingui/nl-NL.l10n"),
	"no-NO": () => require("../../.cache/lingui/no-NO.l10n"),
	"or-IN": () => require("../../.cache/lingui/or-IN.l10n"),
	"pl-PL": () => require("../../.cache/lingui/pl-PL.l10n"),
	"pt-BR": () => require("../../.cache/lingui/pt-BR.l10n"),
	"pt-PT": () => require("../../.cache/lingui/pt-PT.l10n"),
	"ro-RO": () => require("../../.cache/lingui/ro-RO.l10n"),
	"ru-RU": () => require("../../.cache/lingui/ru-RU.l10n"),
	"sk-SK": () => require("../../.cache/lingui/sk-SK.l10n"),
	"sl-SI": () => require("../../.cache/lingui/sl-SI.l10n"),
	"sq-AL": () => require("../../.cache/lingui/sq-AL.l10n"),
	"sr-SP": () => require("../../.cache/lingui/sr-SP.l10n"),
	"sv-SE": () => require("../../.cache/lingui/sv-SE.l10n"),
	"ta-IN": () => require("../../.cache/lingui/ta-IN.l10n"),
	"te-IN": () => require("../../.cache/lingui/te-IN.l10n"),
	"th-TH": () => require("../../.cache/lingui/th-TH.l10n"),
	"tr-TR": () => require("../../.cache/lingui/tr-TR.l10n"),
	"uk-UA": () => require("../../.cache/lingui/uk-UA.l10n"),
	"uz-UZ": () => require("../../.cache/lingui/uz-UZ.l10n"),
	"vi-VN": () => require("../../.cache/lingui/vi-VN.l10n"),
	"zh-CN": () => require("../../.cache/lingui/zh-CN.l10n"),
	"zh-TW": () => require("../../.cache/lingui/zh-TW.l10n"),
	"zu-ZA": () => require("../../.cache/lingui/zu-ZA.l10n"),
};

export async function loadCatalog(locale: Locale): Promise<Messages> {
	const asset = await Asset.fromModule(catalogs[locale]()).downloadAsync();
	if (!asset.localUri) throw new Error("Mobile language asset is unavailable.");
	const catalog = JSON.parse(await new File(asset.localUri).text()) as { messages: Messages };
	return catalog.messages;
}
