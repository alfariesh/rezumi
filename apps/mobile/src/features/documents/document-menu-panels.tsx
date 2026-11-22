// The editor document menu's steps: Duplicate (name and address), Notes (private, never printed) and Details.
import type { ResumeDocument } from "@/draft/types";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { isValidSlug, MAX_SLUG_LENGTH, normalizeSlug } from "@rezumi/resume/sharing";
import { useNewDocuments } from "./new-documents";
import { client } from "@/api/client";
import { resumeFieldFocus, useResumeStore } from "@/draft";
import { RichTextField } from "@/features/entries/rich-text-field";
import { flushResume } from "@/features/share/document";
import { routes } from "@/routes";
import {
	Button,
	Description,
	FieldError,
	Input,
	Label,
	ListRow,
	ListSection,
	Text,
	TextField,
	Typography,
	showToast,
} from "@/ui";

type DuplicatePanelProps = {
	id: string;
	resume: ResumeDocument;
	busy: boolean;
	run: (action: () => Promise<unknown>) => Promise<void>;
};

export function DuplicatePanel({ id, resume, busy, run }: DuplicatePanelProps) {
	const { t } = useLingui();
	const router = useRouter();
	const [name, setName] = useState(() => t`${resume.name} (copy)`.slice(0, 100));
	const [slug, setSlug] = useState("");
	const slugError =
		slug.length > MAX_SLUG_LENGTH
			? t`Use at most 64 characters.`
			: slug && !isValidSlug(slug)
				? t`Use lowercase letters, numbers and single dashes.`
				: undefined;
	const duplicate = () =>
		void run(async () => {
			const current = await flushResume(id);
			const copy = await client.resume.duplicate({
				id,
				name: name.trim(),
				tags: current.tags,
				...(slug ? { slug } : {}),
			});
			useNewDocuments.getState().markNew({ id: copy, type: "resume" });
			showToast({ title: t`Copy created` });
			router.replace(routes.builder(copy));
		});
	return (
		<View className="gap-4">
			<TextField isDisabled={busy}>
				<Label>{t`Name`}</Label>
				<Input variant="secondary" value={name} onChangeText={setName} maxLength={100} accessibilityLabel={t`Name`} />
			</TextField>
			<TextField isDisabled={busy} isInvalid={!!slugError}>
				<Label>{t`Slug`}</Label>
				<Input
					variant="secondary"
					value={slug}
					onChangeText={(value) => setSlug(normalizeSlug(value))}
					autoCapitalize="none"
					autoCorrect={false}
					accessibilityLabel={t`Slug`}
				/>
				{slugError ? (
					<FieldError>{slugError}</FieldError>
				) : (
					<Description>{t`Leave empty to generate an available address from the name.`}</Description>
				)}
			</TextField>
			<Button isDisabled={busy || !name.trim() || !!slugError} onPress={duplicate}>
				<Button.Label>{t`Duplicate`}</Button.Label>
			</Button>
		</View>
	);
}

type NotesPanelProps = { resume: ResumeDocument };

export function NotesPanel({ resume }: NotesPanelProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<Typography type="body-sm" color="muted">
				{t`Keep private notes about this resume here. Nobody else can see them.`}
			</Typography>
			<RichTextField
				label={t`Notes`}
				value={resume.data.metadata.notes}
				tools="letter"
				minLines={6}
				focus={resumeFieldFocus}
				disabled={resume.isLocked}
				onChange={(html) =>
					useResumeStore.getState().update(
						(data) => {
							data.metadata.notes = html;
						},
						{ coalesceKey: "metadata.notes" },
					)
				}
			/>
			<Text size="xs" tone="muted">
				{t`For example, note which companies you sent this resume to, or links to the job descriptions.`}
			</Text>
		</View>
	);
}

type DetailsPanelProps = { resume: ResumeDocument };

export function DetailsPanel({ resume }: DetailsPanelProps) {
	const { t, i18n } = useLingui();
	const sharing = resume.isPublic
		? resume.hasPassword
			? t`Public, with a password`
			: t`Public`
		: t`Private. Only you can see it.`;
	return (
		<View className="gap-3">
			<ListSection>
				<ListRow title={t`Created`} value={resume.createdAt.toLocaleString(i18n.locale)} />
				<ListRow title={t`Last edited`} value={resume.updatedAt.toLocaleString(i18n.locale)} />
				<ListRow title={t`Template`} value={resume.data.metadata.template} />
				<ListRow title={t`Language`} value={resume.data.metadata.page.locale} />
				<ListRow title={t`Sharing`} description={sharing} />
			</ListSection>
			<Text mono selectable tone="muted">
				{resume.slug}
			</Text>
		</View>
	);
}
