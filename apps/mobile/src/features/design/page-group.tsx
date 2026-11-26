import type { DesignProps } from "./types";
import type { MarginId } from "@rezumi/resume/design-presets";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Locale } from "@rezumi/utils/locale";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { applyMargins, matchMargins } from "@rezumi/resume/design-presets";
import { localeSchema } from "@rezumi/utils/locale";
import { MARGIN_NAMES } from "./preset-names";
import { FieldLabel } from "./section";
import { localeMap } from "@/features/account/locale-names";
import { ListRow, ListSection, PickerSheet, Segment, Switch } from "@/ui";

type Page = ResumeData["metadata"]["page"];

/** Page: paper, language (section titles and date words), margins and link underlines. */
export function PageGroup({ data, write, disabled }: DesignProps) {
	const { t, i18n } = useLingui();
	const [picking, setPicking] = useState(false);
	const { page } = data.metadata;
	const margins = matchMargins(data.metadata);
	const languageName = (code: string) => (code in localeMap ? i18n._(localeMap[code as Locale]) : code);
	const set = (key: string, mutate: (draft: Page) => void) => write(key, (draft) => mutate(draft.metadata.page), true);

	return (
		<>
			<View className="gap-2">
				<FieldLabel label={t`Paper`} />
				<Segment<Page["format"]>
					accessibilityLabel={t`Paper`}
					value={page.format}
					isDisabled={disabled}
					onValueChange={(format) => set("format", (draft) => void (draft.format = format))}
					options={[
						{
							value: "letter",
							label: t({ message: "Letter", context: "US Letter paper size (8.5 × 11 in), shown beside A4" }),
						},
						{ value: "a4", label: "A4" },
						{ value: "free-form", label: t`Free-form` },
					]}
				/>
			</View>

			<View className="gap-2">
				<FieldLabel label={t`Margins`} />
				<Segment<MarginId | "">
					accessibilityLabel={t`Margins`}
					value={margins ?? ""}
					isDisabled={disabled}
					onValueChange={(id) => {
						if (id) write("margins", (draft) => applyMargins(draft.metadata, id), true);
					}}
					options={(["narrow", "normal", "wide"] as const).map((id) => ({
						value: id,
						label: i18n._(MARGIN_NAMES[id]),
					}))}
				/>
			</View>

			<ListSection footer={t`Changes section titles and date words only, not your content.`}>
				<ListRow
					icon="translate"
					title={t`Language`}
					value={languageName(page.locale)}
					isDisabled={disabled}
					onPress={() => setPicking(true)}
				/>
				<ListRow
					icon="link-simple-horizontal"
					title={t`Underline links`}
					trailing={
						<Switch
							isSelected={!page.hideLinkUnderline}
							isDisabled={disabled}
							accessibilityLabel={t`Underline links`}
							onSelectedChange={(checked) => set("underline", (draft) => void (draft.hideLinkUnderline = !checked))}
						/>
					}
				/>
			</ListSection>

			<PickerSheet
				isOpen={picking}
				onOpenChange={setPicking}
				title={t`Language`}
				closeLabel={t`Close`}
				searchLabel={t`Search languages`}
				emptyLabel={(query) => t`No language matches “${query}”.`}
				value={page.locale}
				options={localeSchema.options.map((code) => ({ value: code, label: languageName(code), detail: code }))}
				onPick={(locale) => set("locale", (draft) => void (draft.locale = locale as Locale))}
			/>
		</>
	);
}
