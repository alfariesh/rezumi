import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { BaseCommandGroup, PaletteItem, searchText } from "../base";
import { changeLocale, localeMap } from "@/libs/locale";

export function LanguageCommandPage() {
	const { i18n } = useLingui();

	return (
		<BaseCommandGroup page="language" heading={<Trans>Language</Trans>}>
			{Object.entries(localeMap).map(([value, label]) => (
				<PaletteItem
					key={value}
					id={`language.${value}`}
					textValue={searchText(i18n.t(label), [value])}
					onAction={() => changeLocale(value)}
				>
					<span className="font-mono text-xs text-ink-3">{value}</span>
					{i18n.t(label)}
				</PaletteItem>
			))}
		</BaseCommandGroup>
	);
}
