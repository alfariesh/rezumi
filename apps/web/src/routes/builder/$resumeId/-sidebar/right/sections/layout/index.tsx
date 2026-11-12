import type z from "zod";
import { CellSlider } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { metadataSchema } from "@rezumi/schema/resume/data";
import { SectionBase } from "../../shared/section-base";
import { LayoutPages } from "./pages";
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

	return (
		<div className="space-y-4">
			<form.Field name="sidebarWidth">
				{(field) => (
					<CellSlider
						aria-label={t`Sidebar width`}
						minValue={10}
						maxValue={50}
						step={0.1}
						value={field.state.value}
						onChange={(value) => {
							if (typeof value !== "number") return;
							field.handleChange(Math.round(value * 10) / 10);
							handleAutoSave();
						}}
					>
						<CellSlider.Track>
							<CellSlider.Fill />
							<CellSlider.Thumb />
							<CellSlider.Label>
								<Trans>Sidebar width</Trans>
							</CellSlider.Label>
							<CellSlider.Output>{Math.round(field.state.value * 10) / 10}%</CellSlider.Output>
						</CellSlider.Track>
					</CellSlider>
				)}
			</form.Field>
		</div>
	);
}
