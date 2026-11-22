import type { DesignProps } from "./types";
import type { Template } from "@rezumi/schema/templates";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { templateName } from "@rezumi/resume/design-presets";
import { applyTemplatePreset, hasTemplatePreset } from "@rezumi/resume/template-preset";
import { templateLayouts, templatePresets } from "@rezumi/schema/templates";
import { isRTL } from "@rezumi/utils/locale";
import { changeWithUndoToast } from "./draft";
import { FieldLabel } from "./section";
import { TemplatePicture, useLayoutTags } from "./template-card";
import { useThumbnailContent } from "./thumbnails";
import { Button, Icon, Segment, Surface, Text, ValueSlider } from "@/ui";

type TemplateGroupProps = DesignProps & { onBrowse: () => void };

/** Template: the one in use with a way into the gallery, its designed style, and the sidebar of two-column ones. */
export function TemplateGroup({ data, write, disabled, onBrowse }: TemplateGroupProps) {
	const { t } = useLingui();
	const layoutTags = useLayoutTags();
	const current = data.metadata.template;
	// The small picture draws from the resume as it was when Design opened, so every edit doesn't redraw it.
	const [snapshot] = useState(data);
	const content = useThumbnailContent(snapshot);

	return (
		<>
			<View className="flex-row items-center gap-4">
				<View className="aspect-[210/297] w-22 overflow-hidden rounded-lg border border-border bg-paper">
					<TemplatePicture id={current} content={content} width={88} small />
				</View>
				<View className="flex-1 gap-1">
					<Text weight="semibold" size="base">
						{templateName(current)}
					</Text>
					<Text size="xs" tone="muted">
						{layoutTags(current)}
					</Text>
					<Button variant="secondary" size="sm" isDisabled={disabled} onPress={onBrowse} className="mt-2 self-start">
						<Icon name="squares-four" size={16} />
						<Button.Label>{t`Browse templates`}</Button.Label>
					</Button>
				</View>
			</View>
			<PresetPanel data={data} write={write} disabled={disabled} template={current} />
			{templateLayouts[current].columns === 2 ? (
				<SidebarPanel data={data} write={write} disabled={disabled} template={current} />
			) : null}
		</>
	);
}

type PanelProps = DesignProps & { template: Template };

/**
 * The template's own look (`templatePresets`): its fonts and accent, shown before it's applied. Switching templates
 * keeps the person's fonts and colours; this applies the designed ones, with Undo.
 */
function PresetPanel({ data, write, disabled, template }: PanelProps) {
	const { t } = useLingui();
	const preset = templatePresets[template];
	const name = templateName(template);
	const inUse = hasTemplatePreset(data, template);
	const fonts =
		preset.heading.fontFamily === preset.body.fontFamily
			? preset.heading.fontFamily
			: `${preset.heading.fontFamily} · ${preset.body.fontFamily}`;

	return (
		<Surface variant="secondary" className="gap-3 rounded-xl p-4">
			<View className="flex-row items-center gap-3">
				{/* The template's own accent, a document colour: computed, so a style. */}
				<View className="size-6 rounded-full border border-border" style={[{ backgroundColor: preset.primary }]} />
				<View className="min-w-0 flex-1">
					<Text weight="medium">{t`${name} style`}</Text>
					<Text size="xs" tone="muted" numberOfLines={1}>
						{fonts}
					</Text>
				</View>
			</View>
			<Button
				variant="secondary"
				size="sm"
				isDisabled={disabled || inUse}
				className="self-start"
				onPress={() =>
					changeWithUndoToast(
						() => write("preset", (draft) => applyTemplatePreset(draft, template), true),
						() => t`${name} style applied`,
					)
				}
			>
				<Icon name={inUse ? "check" : "palette"} size={16} />
				<Button.Label>{inUse ? t`Style in use` : t`Use ${name} style`}</Button.Label>
			</Button>
		</Surface>
	);
}

/** Two-column templates: the sidebar's side and width. Layout moves sections between columns. */
function SidebarPanel({ data, write, disabled, template }: PanelProps) {
	const { t } = useLingui();
	// The side the page shows now: the chosen one, else the template's own (mirrored on right-to-left pages).
	const own = templateLayouts[template].sidebarSide ?? "left";
	const shownOwn = isRTL(data.metadata.page.locale) ? (own === "left" ? "right" : "left") : own;
	const side = data.metadata.layout.sidebarSide ?? shownOwn;
	const width = data.metadata.layout.sidebarWidth;

	return (
		<Surface variant="secondary" className="gap-4 rounded-xl p-4">
			<View className="gap-2">
				<FieldLabel label={t`Sidebar`} />
				<Segment<"left" | "right">
					accessibilityLabel={t`Sidebar side`}
					value={side}
					isDisabled={disabled}
					onValueChange={(value) =>
						write("sidebarSide", (draft) => void (draft.metadata.layout.sidebarSide = value), true)
					}
					options={[
						{ value: "left", label: t`Left` },
						{ value: "right", label: t`Right` },
					]}
				/>
			</View>
			{/* The stored width shows: Layout allows fractions the 1% steps here round away. */}
			<ValueSlider
				label={t`Width`}
				valueLabel={(value) => `${value}%`}
				value={width}
				minValue={10}
				maxValue={50}
				step={1}
				isDisabled={disabled}
				onCommit={(value) => write("sidebarWidth", (draft) => void (draft.metadata.layout.sidebarWidth = value), true)}
			/>
		</Surface>
	);
}
