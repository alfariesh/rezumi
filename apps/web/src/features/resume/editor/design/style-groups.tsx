import type { DensityId, FontPairingId, MarginId } from "./presets";
import type { Color } from "@heroui/react";
import type { IconDesign, IconStyle, ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { CellColorPicker, CellSlider, Segment } from "@heroui-pro/react";
import { Button, Chip, ColorArea, ColorField, ColorSlider, ColorSwatchPicker, parseColor } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createContext, useContext, useState } from "react";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { contrastOnWhite } from "@rezumi/utils/color";
import { cn } from "@rezumi/utils/style";
import {
	ACCENTS,
	applyDensity,
	applyFontPairing,
	applyMargins,
	applyTextSize,
	darkenForWhite,
	FONT_PAIRINGS,
	hexToRgba,
	matchDensity,
	matchFontPairing,
	matchMargins,
	rgbaToHex,
	TEXT_SIZE,
} from "./presets";
import { CellSelectField } from "@/components/input/select-field";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { getLocaleOptions } from "@/features/locale/locale-options";
import { useIsResumeLocked, useResumeData, useUpdateResumeData } from "@/features/resume/builder/draft";

type Metadata = Pick<ResumeData["metadata"], "typography" | "design" | "page">;

/** Edits the design; `key` names the control, so dragging a slider is one undo step. */
type DesignWriter = (key: string, mutate: (metadata: WritableDraft<Metadata>) => void, discrete?: boolean) => void;

export type DesignSource = {
	metadata: Metadata | undefined;
	write: DesignWriter;
	/** Read-only: disables controls a surrounding `fieldset disabled` can't reach (the accent swatches). */
	locked?: boolean;
};

const DesignSourceContext = createContext<DesignSource | null>(null);

/** Points the Type, Color and Page groups at another design than the open resume's (a letter's own). */
export const DesignSourceProvider = DesignSourceContext.Provider;

export function useDesign(): DesignSource {
	const source = useContext(DesignSourceContext);
	const data = useResumeData();
	const updateResumeData = useUpdateResumeData();
	const locked = useIsResumeLocked();
	if (source) return source;
	return {
		metadata: data?.metadata,
		locked,
		write: (key, mutate, discrete = false) =>
			updateResumeData(
				(draft) => mutate(draft.metadata),
				discrete ? { newStep: true } : { coalesceKey: `design.${key}` },
			),
	};
}

/** A segment option that shares the row and keeps the whole control inside a 300px panel. */
export const SEGMENT_ITEM = "flex-1 px-2";

/** The select's value for fonts that match none of the pairings. */
const CUSTOM_FONTS = "custom";

const familiesLabel = (heading: string, body: string) => (heading === body ? heading : `${heading} + ${body}`);

type TypeGroupProps = {
	/** Brings the exact typography editor into view. Without it, the Custom row isn't offered. */
	onCustomFonts?: () => void;
};

/** Type: five font pairings (or any font, in Advanced), the text size (9–12.5 pt) and density. */
export function TypeGroup({ onCustomFonts }: TypeGroupProps) {
	const { metadata, write } = useDesign();
	if (!metadata) return null;

	const pairing = matchFontPairing(metadata);
	const density = matchDensity(metadata);
	const size = metadata.typography.body.fontSize;
	const { heading, body } = metadata.typography;

	return (
		<div className="grid gap-4">
			<CellSelectField
				label={t`Font`}
				value={pairing ?? (onCustomFonts ? CUSTOM_FONTS : "")}
				onChange={(value) => {
					if (value === CUSTOM_FONTS) onCustomFonts?.();
					else write("pairing", (draft) => applyFontPairing(draft, value as FontPairingId), true);
				}}
				options={[
					...FONT_PAIRINGS.map((option) => ({
						value: option.id,
						textValue: option.label,
						label: (
							<span className="flex min-w-0 items-baseline gap-2">
								<span>{option.label}</span>
								<span className="truncate text-xs text-muted">{familiesLabel(option.heading, option.body)}</span>
							</span>
						),
					})),
					// Any other font is set in Advanced; picking this brings it into view.
					...(onCustomFonts
						? [
								{
									value: CUSTOM_FONTS,
									textValue: t`Custom`,
									label: (
										<span className="flex min-w-0 items-baseline gap-2">
											<span>
												<Trans>Custom</Trans>
											</span>
											{!pairing && (
												<span className="truncate text-xs text-muted">
													{familiesLabel(heading.fontFamily, body.fontFamily)}
												</span>
											)}
										</span>
									),
								},
							]
						: []),
				]}
			/>

			<CellSlider
				aria-label={t`Text size`}
				minValue={TEXT_SIZE.min}
				maxValue={TEXT_SIZE.max}
				step={TEXT_SIZE.step}
				value={Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, size))}
				onChange={(value) =>
					write("size", (draft) => applyTextSize(draft, Array.isArray(value) ? (value[0] ?? size) : value))
				}
			>
				<CellSlider.Track>
					<CellSlider.Fill />
					<CellSlider.Thumb />
					<CellSlider.Label>
						<Trans>Text size</Trans>
					</CellSlider.Label>
					{/* The stored size, not the clamped thumb: an exact size from Advanced can sit outside the range. */}
					<CellSlider.Output>{size} pt</CellSlider.Output>
				</CellSlider.Track>
			</CellSlider>

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Density</Trans>
				</span>
				<Segment
					aria-label={t`Density`}
					selectedKey={density ?? ""}
					onSelectionChange={(key) => write("density", (draft) => applyDensity(draft, key as DensityId), true)}
					className="w-full"
				>
					<Segment.Item id="compact" className={SEGMENT_ITEM}>
						<Trans>Compact</Trans>
					</Segment.Item>
					<Segment.Item id="normal" className={SEGMENT_ITEM}>
						<Trans>Normal</Trans>
					</Segment.Item>
					<Segment.Item id="roomy" className={SEGMENT_ITEM}>
						<Trans>Roomy</Trans>
					</Segment.Item>
				</Segment>
			</div>
		</div>
	);
}

/** Color: eight accents or any custom colour, with its contrast on white and a darker shade when it's too light. */
export function ColorGroup() {
	const { metadata, write, locked = false } = useDesign();
	// A stored grey or black has no hue: keep the colour last dragged to while it still matches, so the thumbs stay put.
	const [picked, setPicked] = useState<Color | null>(null);
	if (!metadata) return null;

	const current = rgbaToHex(metadata.design.colors.primary) ?? "#000000";
	const color = picked?.toString("hex") === current ? picked : parseColor(current);
	const ratio = contrastOnWhite(current);
	const tooLight = ratio < 4.5;

	const setAccent = (next: Color, discrete = true) =>
		write(
			"accent",
			(draft) => {
				draft.design.colors.primary = hexToRgba(next.toString("hex"));
			},
			discrete,
		);

	return (
		<div className="@container grid gap-4">
			<ColorSwatchPicker
				aria-label={t`Accent color`}
				value={current}
				onChange={(next) => setAccent(next)}
				size="lg"
				// Four to a row (48px swatches on touch); eight once the group is wide enough to hold them.
				className="grid grid-cols-4 justify-items-center gap-2 pointer-coarse:gap-3 @xs:pointer-fine:grid-cols-8 @xs:pointer-fine:gap-1"
			>
				{ACCENTS.map((accent) => (
					<ColorSwatchPicker.Item
						key={accent.hex}
						color={accent.hex}
						aria-label={accent.label}
						isDisabled={locked}
						className="pointer-coarse:size-12"
					>
						<ColorSwatchPicker.Swatch />
						<ColorSwatchPicker.Indicator />
					</ColorSwatchPicker.Item>
				))}
			</ColorSwatchPicker>

			<CellColorPicker
				aria-label={t`Custom color`}
				value={color}
				onChange={(next) => {
					setPicked(next);
					setAccent(next, false);
				}}
			>
				<CellColorPicker.Trigger>
					<CellColorPicker.Label>
						<Trans>Custom</Trans>
					</CellColorPicker.Label>
					<CellColorPicker.ValueDisplay />
					<CellColorPicker.Swatch />
				</CellColorPicker.Trigger>
				<CellColorPicker.Popover>
					<ColorArea
						aria-label={t`Saturation and brightness`}
						colorSpace="hsb"
						xChannel="saturation"
						yChannel="brightness"
						className="w-full max-w-full"
					>
						<ColorArea.Thumb />
					</ColorArea>
					<ColorSlider aria-label={t`Hue`} channel="hue" colorSpace="hsb">
						<ColorSlider.Track>
							<ColorSlider.Thumb />
						</ColorSlider.Track>
					</ColorSlider>
					<ColorField aria-label={t`Custom color (hex)`}>
						<ColorField.Group variant="secondary" fullWidth>
							<ColorField.Input className="font-mono" />
							<ColorField.Suffix
								className={cn("pe-3 font-mono text-xs tabular-nums", tooLight ? "text-warning" : "text-muted")}
							>
								<span className="sr-only">
									<Trans>Contrast on white:</Trans>
								</span>
								{ratio.toFixed(1)}:1
							</ColorField.Suffix>
						</ColorField.Group>
					</ColorField>
				</CellColorPicker.Popover>
			</CellColorPicker>

			{tooLight && (
				<div className="grid gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning-soft-foreground" role="status">
					<span className="flex gap-2">
						<Icon name="circle-half" size={20} className="shrink-0" />
						<Trans>Too light for headings on white. It may be hard to read and print faintly.</Trans>
					</span>
					<Button
						size="sm"
						variant="secondary"
						className="w-fit"
						onPress={() => {
							setPicked(null);
							setAccent(parseColor(darkenForWhite(current)));
						}}
					>
						<Trans>Use a darker shade</Trans>
					</Button>
				</div>
			)}
		</div>
	);
}

/** Page: paper, language (section titles and date words), margins, icons and link underlines. */
export function PageGroup() {
	const { metadata, write } = useDesign();
	if (!metadata) return null;

	const { page } = metadata;
	const margins = matchMargins(metadata);

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Paper</Trans>
				</span>
				<Segment
					aria-label={t`Paper`}
					selectedKey={page.format}
					onSelectionChange={(key) =>
						write(
							"format",
							(draft) => {
								draft.page.format = key as typeof page.format;
							},
							true,
						)
					}
					className="w-full"
				>
					<Segment.Item id="letter" className={SEGMENT_ITEM}>
						<Trans context="US Letter paper size (8.5 × 11 in), shown beside A4">Letter</Trans>
					</Segment.Item>
					<Segment.Item id="a4" className={SEGMENT_ITEM}>
						A4
					</Segment.Item>
					<Segment.Item id="free-form" className={SEGMENT_ITEM}>
						<Trans>Free-form</Trans>
					</Segment.Item>
				</Segment>
			</div>

			<CellSelectField
				label={t`Language`}
				// The flag and the language's name; the code in the list view would crowd a cell.
				options={getLocaleOptions().map(({ value, icon, textValue }) => ({ value, icon, label: textValue }))}
				value={page.locale}
				onChange={(locale) =>
					write(
						"locale",
						(draft) => {
							draft.page.locale = locale || "en-US";
						},
						true,
					)
				}
			/>

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Margins</Trans>
				</span>
				<Segment
					aria-label={t`Margins`}
					selectedKey={margins ?? ""}
					onSelectionChange={(key) => write("margins", (draft) => applyMargins(draft, key as MarginId), true)}
					className="w-full"
				>
					<Segment.Item id="narrow" className={SEGMENT_ITEM}>
						<Trans>Narrow</Trans>
					</Segment.Item>
					<Segment.Item id="normal" className={SEGMENT_ITEM}>
						<Trans>Normal</Trans>
					</Segment.Item>
					<Segment.Item id="wide" className={SEGMENT_ITEM}>
						<Trans>Wide</Trans>
					</Segment.Item>
				</Segment>
			</div>

			<div className="grid gap-2">
				<CellSwitchRow
					label={t`Underline links`}
					isSelected={!page.hideLinkUnderline}
					onChange={(checked) =>
						write(
							"underline",
							(draft) => {
								draft.page.hideLinkUnderline = !checked;
							},
							true,
						)
					}
				/>
			</div>
		</div>
	);
}

/**
 * Icons: one switch for all of them, the style every icon is drawn in, and the groups that show. Tool logos sit beside
 * the text they stand for, which applicant tracking systems read either way. They need the plan's `brandLogos` to be
 * switched on; a resume that already shows them can keep them or switch them off.
 */
export function IconsGroup() {
	const { metadata, write } = useDesign();
	const plan = usePlan();
	if (!metadata) return null;

	const icons = iconDesignOf(metadata.design);
	const logosLocked = !icons.logos && !hasPlanFeature(plan, "brandLogos");
	const set = (key: keyof IconDesign, patch: Partial<IconDesign>) =>
		write(
			`icons.${key}`,
			(draft) => {
				draft.design.icons = { ...iconDesignOf(draft.design), ...patch };
			},
			true,
		);
	const groups: { key: "contact" | "sections" | "items" | "logos"; label: string }[] = [
		{
			key: "contact",
			label: t`Contact line`,
		},
		{
			key: "sections",
			label: t`Section titles`,
		},
		{
			key: "items",
			label: t`Skills, interests and profiles`,
		},
		{
			key: "logos",
			label: t`Tool logos in skills`,
		},
	];

	return (
		<div className="grid gap-4">
			<CellSwitchRow
				label={t`Show icons`}
				isSelected={icons.enabled}
				onChange={(enabled) => set("enabled", { enabled })}
			/>

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>Icon style</Trans>
				</span>
				<Segment
					aria-label={t`Icon style`}
					selectedKey={icons.style}
					isDisabled={!icons.enabled}
					onSelectionChange={(key) => set("style", { style: key as IconStyle })}
					className="w-full"
				>
					<Segment.Item id="standard" className={SEGMENT_ITEM}>
						<Trans>Standard</Trans>
					</Segment.Item>
					<Segment.Item id="rounded" className={SEGMENT_ITEM}>
						<Trans>Rounded</Trans>
					</Segment.Item>
					<Segment.Item id="sharp" className={SEGMENT_ITEM}>
						<Trans>Sharp</Trans>
					</Segment.Item>
				</Segment>
			</div>

			<div className="grid gap-2">
				{groups.map(({ key, label }) => {
					const locked = key === "logos" && logosLocked;
					return (
						<CellSwitchRow
							key={key}
							label={
								locked ? (
									<span className="inline-flex flex-wrap items-center gap-2">
										{label}
										<Chip size="sm" variant="soft">
											<Icon name="lock" size={12} aria-hidden />
											Plus
											<span className="sr-only">{t`Not in your plan`}</span>
										</Chip>
									</span>
								) : (
									label
								)
							}
							isSelected={icons[key]}
							isDisabled={!icons.enabled}
							onChange={(checked) =>
								locked ? openPlanDialog({ kind: "feature", feature: "brandLogos" }) : set(key, { [key]: checked })
							}
						/>
					);
				})}
			</div>
		</div>
	);
}
