import type z from "zod";
import { InputGroup, Slider } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import * as React from "react";
import { metadataSchema } from "@rezumi/schema/resume/data";
import { FormControl, FormItem, FormLabel, FormMessage } from "@rezumi/ui/components/form";
import { SectionBase } from "../../shared/section-base";
import { LayoutPages } from "./pages";
import { NumberInput } from "@/components/input/number-input";
import { useCurrentResume, useUpdateResumeData } from "@/features/resume/builder/draft";
import { useSyncFormValues } from "@/hooks/use-sync-form-values";
import { useAppForm } from "@/libs/tanstack-form";

export function LayoutSectionBuilder() {
	return (
		<SectionBase type="layout" className="space-y-4">
			<LayoutPages />
			<LayoutSectionForm />
		</SectionBase>
	);
}

const formSchema = metadataSchema.shape.layout.omit({ pages: true });

type FormValues = z.infer<typeof formSchema>;

function LayoutSectionForm() {
	const resume = useCurrentResume();
	const layout = resume.data.metadata.layout;
	const updateResumeData = useUpdateResumeData();

	const persist = (data: FormValues) => {
		updateResumeData((draft) => {
			draft.metadata.layout.sidebarWidth = data.sidebarWidth;
		});
	};

	const form = useAppForm({
		defaultValues: { sidebarWidth: layout.sidebarWidth },
		validators: { onChange: formSchema },
	});
	useSyncFormValues(form, { sidebarWidth: layout.sidebarWidth });

	const handleAutoSave = () => {
		persist(form.state.values);
	};

	const labelId = React.useId();

	return (
		<div className="space-y-4">
			<form.Field name="sidebarWidth">
				{(field) => (
					<FormItem hasError={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
						<FormLabel id={labelId}>
							<Trans>Sidebar width</Trans>
						</FormLabel>
						<div className="flex items-center gap-4">
							<Slider
								aria-labelledby={labelId}
								className="min-w-0 flex-1"
								minValue={10}
								maxValue={50}
								step={0.01}
								value={field.state.value}
								onChange={(value) => {
									if (typeof value !== "number") return;
									field.handleChange(value);
									handleAutoSave();
								}}
							>
								<Slider.Track>
									<Slider.Fill />
									<Slider.Thumb />
								</Slider.Track>
							</Slider>

							<InputGroup className="w-auto shrink-0">
								<FormControl
									render={
										<NumberInput
											name={field.name}
											value={field.state.value}
											min={10}
											max={50}
											step={0.1}
											onBlur={field.handleBlur}
											onValueChange={(value) => {
												field.handleChange(value);
												handleAutoSave();
											}}
										/>
									}
								/>
								<InputGroup.Suffix>%</InputGroup.Suffix>
							</InputGroup>
						</div>
						<FormMessage errors={field.state.meta.errors} />
					</FormItem>
				)}
			</form.Field>
		</div>
	);
}
