import type { DesignProps } from "./types";
import type { DensityId } from "@rezumi/resume/design-presets";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import {
	FONT_PAIRINGS,
	TEXT_SIZE,
	applyDensity,
	applyFontPairing,
	applyTextSize,
	matchDensity,
	matchFontPairing,
} from "@rezumi/resume/design-presets";
import { PAIRING_NAMES } from "./preset-names";
import { FieldLabel } from "./section";
import { ListRow, ListSection, Segment, Sheet, ValueSlider } from "@/ui";

const familiesLabel = (heading: string, body: string) => (heading === body ? heading : `${heading} + ${body}`);

type TypeGroupProps = DesignProps & {
	/** Opens the exact typography screen: any font, weights, sizes. */
	onCustomFonts: () => void;
};

/** Type: five font pairings (or any font, in Typography), the text size (9–12.5 pt) and density. */
export function TypeGroup({ data, write, disabled, onCustomFonts }: TypeGroupProps) {
	const { t, i18n } = useLingui();
	const [picking, setPicking] = useState(false);
	const { metadata } = data;
	const pairing = matchFontPairing(metadata);
	const density = matchDensity(metadata);
	const size = metadata.typography.body.fontSize;
	const { heading, body } = metadata.typography;

	return (
		<>
			<ListSection>
				<ListRow
					icon="text-aa"
					title={t`Font`}
					value={pairing ? i18n._(PAIRING_NAMES[pairing]) : t`Custom`}
					description={familiesLabel(heading.fontFamily, body.fontFamily)}
					isDisabled={disabled}
					onPress={() => setPicking(true)}
				/>
			</ListSection>

			{/* The stored size shows, not the clamped thumb: an exact size from Typography can sit outside the range. */}
			<ValueSlider
				label={t`Text size`}
				valueLabel={(value) => t`${value} pt`}
				value={size}
				minValue={TEXT_SIZE.min}
				maxValue={TEXT_SIZE.max}
				step={TEXT_SIZE.step}
				isDisabled={disabled}
				onCommit={(value) => write("size", (draft) => applyTextSize(draft.metadata, value), true)}
			/>

			<View className="gap-2">
				<FieldLabel label={t`Density`} />
				<Segment<DensityId | "">
					accessibilityLabel={t`Density`}
					value={density ?? ""}
					isDisabled={disabled}
					onValueChange={(value) => {
						if (value) write("density", (draft) => applyDensity(draft.metadata, value), true);
					}}
					options={[
						{ value: "compact", label: t`Compact` },
						{ value: "normal", label: t`Normal` },
						{ value: "roomy", label: t`Roomy` },
					]}
				/>
			</View>

			<Sheet isOpen={picking} onOpenChange={setPicking} title={t`Font`} closeLabel={t`Close`}>
				<ListSection>
					{FONT_PAIRINGS.map((option) => (
						<ListRow
							key={option.id}
							title={i18n._(PAIRING_NAMES[option.id])}
							description={familiesLabel(option.heading, option.body)}
							chevron={false}
							isSelected={option.id === pairing}
							onPress={() => {
								setPicking(false);
								write("pairing", (draft) => applyFontPairing(draft.metadata, option.id), true);
							}}
						/>
					))}
					<ListRow
						key="custom"
						title={t`Custom`}
						description={t`Any font, with its weights and sizes`}
						isSelected={!pairing}
						onPress={() => {
							setPicking(false);
							onCustomFonts();
						}}
					/>
				</ListSection>
			</Sheet>
		</>
	);
}
