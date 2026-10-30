import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../../store";
import { BaseCommandGroup, PaletteItem, searchText } from "../base";
import { LanguageCommandPage } from "./language";
import { ThemeCommandPage } from "./theme";

export function PreferencesCommandGroup() {
	const pushPage = useCommandPaletteStore((state) => state.pushPage);

	return (
		<>
			<BaseCommandGroup heading={<Trans>Preferences</Trans>}>
				<PaletteItem
					id="preferences.theme"
					textValue={searchText(t`Change theme to…`, [t`Theme`, t`Light`, t`Dark`])}
					onAction={() => pushPage("theme")}
				>
					<Icon name="palette" size={16} />
					<Trans>Change theme to…</Trans>
				</PaletteItem>

				<PaletteItem
					id="preferences.language"
					textValue={searchText(t`Change language to…`, [t`Language`])}
					onAction={() => pushPage("language")}
				>
					<Icon name="translate" size={16} />
					<Trans>Change language to…</Trans>
				</PaletteItem>
			</BaseCommandGroup>

			<ThemeCommandPage />
			<LanguageCommandPage />
		</>
	);
}
