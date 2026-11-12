import type { Color } from "@heroui/react";
import type z from "zod";
import { CellColorPicker } from "@heroui-pro/react";
import { ColorArea, ColorField, ColorSlider, parseColor } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useSelector } from "@tanstack/react-form";
import { useState } from "react";
import { colorDesignSchema, iconDesignOf, levelDesignSchema } from "@rezumi/schema/resume/data";
import { resolveLevelDisplaySizes } from "@rezumi/schema/resume/level-display-sizes";
import { FormControl, FormItem, FormLabel } from "@rezumi/ui/components/form";
import { SectionBase } from "../shared/section-base";
import { IconPicker } from "@/components/input/icon-picker";
import { LevelTypeCombobox } from "@/components/level/combobox";
import { LevelDisplay } from "@/components/level/display";
import { useCurrentResume, useUpdateResumeData } from "@/features/resume/builder/draft";
import { useSyncFormValues } from "@/hooks/use-sync-form-values";
import { useAppForm } from "@/libs/tanstack-form";

export function DesignSectionBuilder() {
	return (
		<SectionBase type="design" className="space-y-6">
			<ColorSectionForm />
			<LevelSectionForm />
		</SectionBase>
	);
}

type ColorValues = z.infer<typeof colorDesignSchema>;

function useColorSectionForm(colors: ColorValues, persist: (data: ColorValues) => void) {
	const form = useAppForm({
		defaultValues: colors,
		validators: { onChange: colorDesignSchema },
		listeners: {
			onChange: ({ formApi }) => {
				persist(formApi.state.values);
			},
		},
	});
	useSyncFormValues(form, colors);
	return form;
}

type ColorSectionForm = ReturnType<typeof useColorSectionForm>;

function ColorSectionForm() {
	const resume = useCurrentResume();
	const colors = resume.data.metadata.design.colors;
	const updateResumeData = useUpdateResumeData();

	const persist = (data: ColorValues) => {
		updateResumeData((draft) => {
			draft.metadata.design.colors = data;
		});
	};

	const form = useColorSectionForm(colors, persist);

	return (
		<div className="space-y-4">
			<ColorFormField form={form} name="primary" label={t`Primary color`} />
			<ColorFormField form={form} name="text" label={t`Text color`} />
			<ColorFormField form={form} name="background" label={t`Background color`} />
		</div>
	);
}

type ColorFormFieldProps = {
	form: ColorSectionForm;
	name: keyof ColorValues;
	label: string;
};

const BLACK = parseColor("rgba(0, 0, 0, 1)");

/** The stored `rgba()` string as a colour; anything unparseable (a CSS keyword, say) shows as black. */
function toColor(value: string): Color {
	try {
		return parseColor(value);
	} catch {
		return BLACK;
	}
}

/** One of the design's colours as a cell: its name, its hex and a swatch, with the picker in a popover. */
function ColorFormField({ form, name, label }: ColorFormFieldProps) {
	// A stored grey or black has no hue: keep the colour last dragged to while it still matches, so the thumbs stay put.
	const [picked, setPicked] = useState<Color | null>(null);

	return (
		<form.Field name={name}>
			{(field) => {
				const color = picked && picked.toString("rgba") === field.state.value ? picked : toColor(field.state.value);
				const pick = (next: Color) => {
					setPicked(next);
					field.handleChange(next.toString("rgba"));
				};

				return (
					<CellColorPicker aria-label={label} value={color} onChange={pick}>
						<CellColorPicker.Trigger>
							<CellColorPicker.Label>{label}</CellColorPicker.Label>
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
							<ColorSlider aria-label={t`Opacity`} channel="alpha">
								<ColorSlider.Track>
									<ColorSlider.Thumb />
								</ColorSlider.Track>
							</ColorSlider>
							<ColorField
								aria-label={t`Hex color`}
								// A hex has no opacity: keep the one set on the slider.
								onChange={(next) => next && pick(next.withChannelValue("alpha", color.getChannelValue("alpha")))}
							>
								<ColorField.Group variant="secondary" fullWidth>
									<ColorField.Input className="font-mono" />
								</ColorField.Group>
							</ColorField>
						</CellColorPicker.Popover>
					</CellColorPicker>
				);
			}}
		</form.Field>
	);
}

type LevelValues = z.infer<typeof levelDesignSchema>;
type LevelType = LevelValues["type"];

function LevelSectionForm() {
	const resume = useCurrentResume();
	const colors = resume.data.metadata.design.colors;
	const levelDesign = resume.data.metadata.design.level;
	const updateResumeData = useUpdateResumeData();

	const persist = (data: LevelValues) => {
		updateResumeData((draft) => {
			draft.metadata.design.level = data;
		});
	};

	const form = useAppForm({
		defaultValues: levelDesign,
		validators: { onChange: levelDesignSchema },
		listeners: {
			onChange: ({ formApi }) => {
				persist(formApi.state.values);
			},
		},
	});
	useSyncFormValues(form, levelDesign);

	const previewType = useSelector(form.store, (s) => s.values.type);
	const previewIcon = useSelector(form.store, (s) => s.values.icon);
	const iconStyle = iconDesignOf(resume.data.metadata.design).style;
	const { decorationSize, levelIconExplicitSize } = resolveLevelDisplaySizes({
		bodyFontSize: resume.data.metadata.typography.body.fontSize,
	});

	return (
		<div className="space-y-4">
			<h4 className="text-sm font-semibold">
				<Trans>Level</Trans>
			</h4>

			<div
				style={{ "--page-primary-color": colors.primary, backgroundColor: colors.background } as React.CSSProperties}
				className="flex items-center justify-center rounded-xl p-6 ring-1 ring-black/5 ring-inset dark:ring-white/10"
			>
				<LevelDisplay
					level={3}
					type={previewType}
					icon={previewIcon}
					iconVariant={iconStyle}
					decorationSizePx={decorationSize}
					iconSizePx={levelIconExplicitSize}
					className="w-full max-w-[220px] justify-center"
				/>
			</div>

			<div className="flex items-center gap-3">
				<form.Field name="icon">
					{(field) => (
						<FormItem className="shrink-0" hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
							<FormLabel>
								<Trans>Icon</Trans>
							</FormLabel>
							<FormControl
								render={
									<IconPicker
										value={field.state.value}
										iconStyle={iconStyle}
										onChange={(value) => {
											field.handleChange(value);
										}}
									/>
								}
							/>
						</FormItem>
					)}
				</form.Field>

				<form.Field name="type">
					{(field) => (
						<FormItem className="flex-1" hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
							<FormLabel>
								<Trans>Type</Trans>
							</FormLabel>
							<FormControl
								render={
									<LevelTypeCombobox
										variant="secondary"
										value={field.state.value}
										onValueChange={(value) => {
											if (!value) return;
											field.handleChange(value as LevelType);
										}}
									/>
								}
							/>
						</FormItem>
					)}
				</form.Field>
			</div>
		</div>
	);
}
