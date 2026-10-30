import type { DensityId, FontPairingId, MarginId } from "./presets";
import type { Color } from "@heroui/react";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { WritableDraft } from "immer";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
	Button,
	ColorArea,
	ColorField,
	ColorPicker,
	ColorSlider,
	ColorSwatch,
	ColorSwatchPicker,
	Label,
	parseColor,
	Slider,
} from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createContext, useContext, useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
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
import { Combobox } from "@/components/ui/combobox";
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

// A selectable row: a quiet card that takes the accent when chosen. Siblings share the height.
const OPTION_ROW =
	"h-12 flex-row items-center gap-3 rounded-xl border-0 bg-surface-secondary px-4 py-0 data-selected:bg-accent-soft";

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
			<div className="grid gap-2">
				<RadioButtonGroup
					aria-label={t`Font pairing`}
					value={pairing ?? null}
					onChange={(value) => write("pairing", (draft) => applyFontPairing(draft, value as FontPairingId), true)}
					className="flex-col gap-2"
				>
					{FONT_PAIRINGS.map((option) => (
						<RadioButtonGroup.Item key={option.id} value={option.id} className={OPTION_ROW}>
							<RadioButtonGroup.ItemContent className="flex-row items-baseline gap-3 pe-7">
								<span className="text-sm font-medium">{option.label}</span>
								<span className="truncate text-xs text-muted">{familiesLabel(option.heading, option.body)}</span>
							</RadioButtonGroup.ItemContent>
							<RadioButtonGroup.Indicator className="end-3 top-1/2 -translate-y-1/2">
								<Icon name="check" />
							</RadioButtonGroup.Indicator>
						</RadioButtonGroup.Item>
					))}
				</RadioButtonGroup>

				{onCustomFonts && (
					<Button
						variant="ghost"
						fullWidth
						onPress={onCustomFonts}
						className="h-12 justify-start gap-3 rounded-xl border border-dashed border-border px-4 text-start font-normal"
					>
						<span className="text-sm font-medium">
							<Trans>Custom</Trans>
						</span>
						<span className="truncate text-xs text-muted">
							{pairing ? <Trans>Any font, in Advanced</Trans> : familiesLabel(heading.fontFamily, body.fontFamily)}
						</span>
						<Icon name="arrow-down" size={18} className="ms-auto text-muted" />
					</Button>
				)}
			</div>

			<div className="grid gap-1.5">
				<Slider
					minValue={TEXT_SIZE.min}
					maxValue={TEXT_SIZE.max}
					step={TEXT_SIZE.step}
					value={Math.min(TEXT_SIZE.max, Math.max(TEXT_SIZE.min, size))}
					onChange={(value) =>
						write("size", (draft) => applyTextSize(draft, Array.isArray(value) ? (value[0] ?? size) : value))
					}
				>
					<Label>
						<Trans>Text size</Trans>
					</Label>
					{/* The stored size, not the clamped thumb: an exact size from Advanced can sit outside the range. */}
					<Slider.Output className="text-muted">{size} pt</Slider.Output>
					<Slider.Track>
						<Slider.Fill />
						<Slider.Thumb />
					</Slider.Track>
				</Slider>
				<span className="text-xs text-muted">
					<Trans>10–11 recommended</Trans>
				</span>
			</div>

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

			<div className="flex items-center gap-3">
				<ColorPicker
					value={color}
					onChange={(next) => {
						setPicked(next);
						setAccent(next, false);
					}}
				>
					<ColorPicker.Trigger aria-label={t`Custom color`} className="shrink-0 rounded-full">
						<ColorSwatch size="lg" />
					</ColorPicker.Trigger>
					<ColorPicker.Popover placement="bottom start" className="w-64">
						<ColorArea
							aria-label={t`Saturation and brightness`}
							colorSpace="hsb"
							xChannel="saturation"
							yChannel="brightness"
							className="w-full"
						>
							<ColorArea.Thumb />
						</ColorArea>
						<ColorSlider aria-label={t`Hue`} channel="hue" colorSpace="hsb">
							<ColorSlider.Track>
								<ColorSlider.Thumb />
							</ColorSlider.Track>
						</ColorSlider>
					</ColorPicker.Popover>
				</ColorPicker>

				<ColorField
					aria-label={t`Custom color (hex)`}
					value={color}
					onChange={(next) => {
						if (!next) return;
						setPicked(null);
						setAccent(next);
					}}
					className="min-w-0 flex-1"
				>
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
			</div>

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

			<p className="text-xs text-muted">
				<Trans>
					Accent is used for headings, icons and the header band. Body text stays near-black for print and ATS.
				</Trans>
			</p>
		</div>
	);
}

/** Page: paper, language (section titles and date words), margins, icons and link underlines. */
export function PageGroup() {
	const { metadata, write } = useDesign();
	const languageId = useId();
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

			<div className="grid gap-2">
				<label htmlFor={languageId} className="text-sm font-medium">
					<Trans>Language</Trans>
				</label>
				<Combobox
					variant="secondary"
					id={languageId}
					options={getLocaleOptions()}
					value={page.locale}
					onValueChange={(locale) =>
						write(
							"locale",
							(draft) => {
								draft.page.locale = (locale ?? "en-US") as string;
							},
							true,
						)
					}
				/>
				<span className="text-xs text-muted">
					<Trans>Changes section titles and date words only, not your content.</Trans>
				</span>
			</div>

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

			<div className="grid">
				<SwitchRow
					label={t`Icons in contact line`}
					description={t`Also shows the icons on skills, profiles and interests.`}
					isSelected={!page.hideIcons}
					onChange={(checked) =>
						write(
							"icons",
							(draft) => {
								draft.page.hideIcons = !checked;
							},
							true,
						)
					}
				/>
				<SwitchRow
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
