// Details (the web's Details widget): salary, source, when it was applied and the tags; Edit details opens the form
// for role, company, place, salary, source, posting link and tags.
import type { Application } from "../types";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { useUserTime } from "../date";
import { useApplicationMutations } from "../queries";
import { FormField } from "./form-field";
import { DetailSection } from "./section";
import { Button, ChipInput, Icon, ListRow, ListSection, Sheet, showToast } from "@/ui";

type FactsProps = { application: Application; onEdit: () => void };

export function Facts({ application, onEdit }: FactsProps) {
	const { t } = useLingui();
	const { date } = useUserTime();
	return (
		<DetailSection
			title={t`Details`}
			testID="facts"
			action={
				<Button size="sm" variant="ghost" onPress={onEdit} testID="facts-edit">
					<Icon name="pencil-simple" size={16} />
					<Button.Label>{t`Edit details`}</Button.Label>
				</Button>
			}
		>
			<ListSection>
				<ListRow title={t`Salary`} value={application.salary || "—"} />
				<ListRow title={t`Source`} value={application.source || "—"} />
				<ListRow
					title={t`Applied`}
					value={application.status === "saved" ? t`Not applied yet` : date(application.appliedAt)}
				/>
				<ListRow
					title={t`Tags`}
					value={application.tags.length ? application.tags.map((tag) => `#${tag}`).join(" ") : "—"}
				/>
			</ListSection>
		</DetailSection>
	);
}

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
};

type EditDetailsSheetProps = { application: Application; isOpen: boolean; onOpenChange: (open: boolean) => void };

export function EditDetailsSheet({ application, isOpen, onOpenChange }: EditDetailsSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t`Edit details`} closeLabel={t`Close`} detents={[0.9]}>
			{isOpen ? <EditDetailsForm application={application} onDone={() => onOpenChange(false)} /> : null}
		</Sheet>
	);
}

type EditDetailsFormProps = { application: Application; onDone: () => void };

export function EditDetailsForm({ application, onDone }: EditDetailsFormProps) {
	const { t } = useLingui();
	const { update } = useApplicationMutations();
	const [draft, setDraft] = useState({
		role: application.role,
		company: application.company,
		location: application.location ?? "",
		salary: application.salary ?? "",
		source: application.source ?? "",
		sourceUrl: application.sourceUrl ?? "",
	});
	const [tags, setTags] = useState<string[]>([...application.tags]);
	const set = (key: keyof typeof draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
	const urlInvalid = draft.sourceUrl.trim() !== "" && !isHttpUrl(draft.sourceUrl.trim());
	const ready = draft.role.trim() && draft.company.trim() && !urlInvalid && !update.isPending;
	const save = () =>
		update.mutate(
			{
				id: application.id,
				role: draft.role.trim(),
				company: draft.company.trim(),
				location: draft.location.trim() || null,
				salary: draft.salary.trim() || null,
				source: draft.source.trim() || null,
				sourceUrl: draft.sourceUrl.trim() || null,
				tags,
			},
			{
				onSuccess: onDone,
				onError: () => showToast({ title: t`Couldn't save the details. Try again.`, variant: "danger" }),
			},
		);
	return (
		<View className="gap-4 pb-2">
			<FormField label={t`Role`} value={draft.role} onChangeText={set("role")} isRequired maxLength={200} />
			<FormField label={t`Company`} value={draft.company} onChangeText={set("company")} isRequired maxLength={200} />
			<FormField label={t`Location`} value={draft.location} onChangeText={set("location")} />
			<FormField label={t`Salary`} value={draft.salary} onChangeText={set("salary")} />
			<FormField
				label={t`Source`}
				value={draft.source}
				placeholder={t`LinkedIn, a referral…`}
				onChangeText={set("source")}
			/>
			<FormField
				label={t`Posting link`}
				value={draft.sourceUrl}
				onChangeText={set("sourceUrl")}
				keyboardType="url"
				autoCapitalize="none"
				autoCorrect={false}
				error={urlInvalid ? t`Use an http or https link.` : null}
			/>
			<ChipInput
				label={t`Tags`}
				values={tags}
				onChange={setTags}
				removeLabel={(tag) => t`Remove ${tag}`}
				placeholder={t`Add a tag`}
				variant="secondary"
			/>
			<Button variant="primary" isDisabled={!ready} onPress={save} testID="details-save">
				<Button.Label>{t`Save details`}</Button.Label>
			</Button>
		</View>
	);
}
