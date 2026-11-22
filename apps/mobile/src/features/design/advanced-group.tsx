import type { DesignProps } from "./types";
import type { DesignScreen } from "@/routes";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { getFontDisplayName } from "@rezumi/fonts";
import { DATE_FORMATS, resetDesign } from "@rezumi/resume/design-presets";
import { useResumeStore } from "@/draft";
import { Button, Icon, ListRow, ListSection, Sheet, showToast } from "@/ui";

type AdvancedGroupProps = DesignProps & { onOpen: (screen: DesignScreen) => void };

/** Advanced: the date format, every exact value on its own screen, and Reset design defaults. No custom CSS here. */
export function AdvancedGroup({ data, write, disabled, onOpen }: AdvancedGroupProps) {
	const { t } = useLingui();
	const [picking, setPicking] = useState(false);
	const { metadata } = data;
	const dateFormat = metadata.page.dateFormat ?? "short";
	const reset = () => {
		// Paper, language, date format and section placement are the person's, not the look's; they stay.
		write("reset", (draft) => resetDesign(draft.metadata), true);
		showToast({
			title: t`Design reset to defaults`,
			undo: { label: t`Undo`, onUndo: () => useResumeStore.getState().undo() },
		});
	};

	return (
		<>
			<ListSection>
				<ListRow
					icon="calendar-blank"
					title={t`Date format`}
					value={DATE_FORMATS.find((format) => format.value === dateFormat)?.label}
					isDisabled={disabled}
					onPress={() => setPicking(true)}
				/>
				<ListRow
					icon="text-aa"
					title={t`Typography`}
					description={`${getFontDisplayName(metadata.typography.body.fontFamily)} · ${t`${metadata.typography.body.fontSize} pt`}`}
					onPress={() => onOpen("typography")}
				/>
				<ListRow
					icon="palette"
					title={t`Colors and levels`}
					description={t`Text, background, and how skill levels draw`}
					onPress={() => onOpen("colors")}
				/>
				<ListRow
					icon="file"
					title={t`Page`}
					description={t`Margins ${metadata.page.marginX} × ${metadata.page.marginY} pt`}
					onPress={() => onOpen("page")}
				/>
				<ListRow
					icon="rows"
					title={t`Layout`}
					description={plural(metadata.layout.pages.length, { one: "# page", other: "# pages" })}
					onPress={() => onOpen("layout")}
				/>
			</ListSection>
			<Button variant="secondary" isDisabled={disabled} onPress={reset} className="self-start">
				<Icon name="arrow-counter-clockwise" size={16} />
				<Button.Label>{t`Reset design defaults`}</Button.Label>
			</Button>

			<Sheet isOpen={picking} onOpenChange={setPicking} title={t`Date format`} closeLabel={t`Close`}>
				<ListSection>
					{DATE_FORMATS.map((format) => (
						<ListRow
							key={format.value}
							title={format.label}
							chevron={false}
							isSelected={format.value === dateFormat}
							onPress={() => {
								setPicking(false);
								write("dateFormat", (draft) => void (draft.metadata.page.dateFormat = format.value), true);
							}}
						/>
					))}
				</ListSection>
			</Sheet>
		</>
	);
}
