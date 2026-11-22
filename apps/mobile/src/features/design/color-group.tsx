import type { DesignProps } from "./types";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
	ACCENTS,
	MIN_CONTRAST,
	hexToRgba,
	isValidHex,
	measureContrast,
	paperTone,
	readableShade,
	rgbaToHex,
} from "@rezumi/resume/design-presets";
import { ACCENT_NAMES } from "./preset-names";
import { Alert, Button, FieldError, Icon, Input, Label, Text, TextField, cx } from "@/ui";

/** Color: eight accents or any hex, with its contrast on the page and a readable shade when it's too faint there. */
export function ColorGroup({ data, write, disabled }: DesignProps) {
	const { t, i18n } = useLingui();
	const { primary, background } = data.metadata.design.colors;
	// Every saved accent is rgba; anything else shows an empty field.
	const current = rgbaToHex(primary) ?? "";
	const [hex, setHex] = useState(current);
	// Undo, redo or another device can change the colour under the field: show it, unless the field already says it.
	const [shown, setShown] = useState(current);
	if (current !== shown) {
		setShown(current);
		if (!isValidHex(hex) || rgbaToHex(hexToRgba(hex)) !== current) setHex(current);
	}
	// Measured on the page's own background; a colour that can't be read (named, hsl) shows no ratio and no warning.
	const ratio = measureContrast(primary, background);
	const unreadable = ratio !== null && ratio < MIN_CONTRAST;
	const tone = paperTone(background);
	const setAccent = (next: string, discrete = true) =>
		write(
			"accent",
			(draft) => {
				draft.metadata.design.colors.primary = hexToRgba(next);
			},
			discrete,
		);

	return (
		<>
			<View accessibilityRole="radiogroup" accessibilityLabel={t`Accent color`} className="flex-row flex-wrap gap-2">
				{ACCENTS.map((accent) => {
					const selected = accent.hex === current;
					return (
						<Pressable
							key={accent.hex}
							accessibilityRole="radio"
							accessibilityLabel={i18n._(ACCENT_NAMES[accent.label])}
							accessibilityState={{ checked: selected, disabled }}
							disabled={disabled}
							onPress={() => {
								setHex(accent.hex);
								setAccent(accent.hex);
							}}
							className={cx("size-12 rounded-xl border-2 p-0.5", selected ? "border-foreground" : "border-transparent")}
						>
							{/* A document colour from the shared palette, not an app colour: computed, so a style. */}
							<View className="flex-1 items-center justify-center rounded-lg" style={[{ backgroundColor: accent.hex }]}>
								{selected ? <Icon name="check" size={16} tone="accent-foreground" /> : null}
							</View>
						</Pressable>
					);
				})}
			</View>

			<TextField isInvalid={!!hex && !isValidHex(hex)} isDisabled={disabled}>
				<Label>{t`Custom color (hex)`}</Label>
				<View className="flex-row items-center gap-2">
					<View
						className="size-11 rounded-xl border border-border"
						style={[{ backgroundColor: current || undefined }]}
					/>
					<Input
						variant="secondary"
						value={hex}
						autoCapitalize="characters"
						autoCorrect={false}
						maxLength={7}
						accessibilityLabel={t`Custom color (hex)`}
						className="flex-1 font-mono"
						onChangeText={(value) => {
							setHex(value);
							if (isValidHex(value)) setAccent(value, false);
						}}
					/>
					{ratio === null ? null : (
						<Text
							mono
							tabular
							tone={unreadable ? "warning" : "muted"}
							accessibilityLabel={t`Contrast ${ratio.toFixed(1)} to 1`}
						>
							{`${ratio.toFixed(1)}:1`}
						</Text>
					)}
				</View>
				<FieldError>{t`Use six hex digits, like #3E6B4F.`}</FieldError>
			</TextField>

			{unreadable && current ? (
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>
							{tone === "white"
								? t`Too light for headings on white. It may be hard to read and print faintly.`
								: tone === "light"
									? t`Too light for headings on this background color. It may be hard to read and print faintly.`
									: t`Too dark for headings on this background color. It may be hard to read.`}
						</Alert.Description>
						<Button
							size="sm"
							variant="secondary"
							isDisabled={disabled}
							className="mt-2 self-start"
							onPress={() => {
								const shade = readableShade(current, background);
								setHex(shade);
								setAccent(shade);
							}}
						>
							<Button.Label>{tone === "dark" ? t`Use a lighter shade` : t`Use a darker shade`}</Button.Label>
						</Button>
					</Alert.Content>
				</Alert>
			) : null}

			<Text size="xs" tone="muted" className="leading-5">
				{t`Accent is used for headings, icons and the header band. Body text stays near-black for print and ATS.`}
			</Text>
		</>
	);
}
