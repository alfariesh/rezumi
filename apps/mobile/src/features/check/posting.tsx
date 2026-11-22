import type { Application } from "./job-match";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { MAX_POSTING_CHARS } from "@rezumi/resume/check";
import { ApplicationPicker } from "./application-picker";
import { CheckSection } from "./check-section";
import { SavePostingSheet } from "./save-posting-sheet";
import { useLinkApplication } from "./use-link-application";
import { orpc } from "@/api/client";
import { useInvalidateApplications } from "@/features/applications/queries";
import { Avatar, Button, Icon, Separator, Text, TextArea, TextField, showToast } from "@/ui";

type PostingSourceProps = {
	id: string;
	application: Application | null;
	locked: boolean;
	offline: boolean;
	onClearPasted: () => void;
	pasted: string;
};

/** Where the posting comes from, with Change (another application, or unlink) or Save as application. */
export function PostingSource({ id, application, locked, offline, onClearPasted, pasted }: PostingSourceProps) {
	const { t } = useLingui();
	const [picking, setPicking] = useState(false);
	const [saving, setSaving] = useState(false);
	const { link, linking } = useLinkApplication(id);
	const busy = locked || offline || linking;

	return (
		<CheckSection icon="briefcase" title={t`Posting`}>
			<View className="flex-row items-center gap-3">
				<Avatar size="sm" alt="">
					<Avatar.Fallback>
						{application ? application.company.slice(0, 1).toUpperCase() : <Icon name="copy" size={16} />}
					</Avatar.Fallback>
				</Avatar>
				<View className="min-w-0 flex-1">
					<Text weight="semibold" numberOfLines={1}>
						{application ? `${application.role} · ${application.company}` : t`Pasted posting`}
					</Text>
					<Text size="xs" tone="muted">
						{application ? t`Posting from the linked application` : t`For this visit only`}
					</Text>
				</View>
				{application ? (
					<Button variant="secondary" size="sm" isDisabled={busy} onPress={() => setPicking(true)}>
						<Button.Label>{t`Change`}</Button.Label>
					</Button>
				) : (
					<Button variant="secondary" size="sm" onPress={onClearPasted}>
						<Button.Label>{t`Clear`}</Button.Label>
					</Button>
				)}
			</View>
			{application ? null : (
				<Button variant="ghost" className="self-start" isDisabled={busy} onPress={() => setSaving(true)}>
					<Icon name="briefcase" size={20} />
					<Button.Label>{t`Save as application…`}</Button.Label>
				</Button>
			)}
			<ApplicationPicker
				isOpen={picking}
				onOpenChange={setPicking}
				value={application?.id ?? null}
				onPick={(next) => void link(next)}
				onUnlink={() => void link(null)}
			/>
			<SavePostingSheet
				isOpen={saving}
				onOpenChange={setSaving}
				posting={pasted}
				onSaved={async (applicationId) => {
					if (await link(applicationId)) {
						onClearPasted();
						showToast({ title: t`Saved as an application and linked` });
					}
				}}
			/>
		</CheckSection>
	);
}

type NoPostingProps = {
	id: string;
	application: Application | null;
	locked: boolean;
	offline: boolean;
	onPaste: (posting: string) => void;
};

/**
 * Nothing to match against. Link an existing application first; pasting a posting is the fallback. A linked
 * application without a saved posting takes one here, saved to the application.
 */
export function NoPosting({ id, application, locked, offline, onPaste }: NoPostingProps) {
	const { t } = useLingui();
	const [draft, setDraft] = useState("");
	const [picking, setPicking] = useState(false);
	const { link, linking } = useLinkApplication(id);
	const invalidate = useInvalidateApplications();
	const save = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => invalidate(),
		onError: () => showToast({ title: t`Couldn't save the posting. Try again.`, variant: "danger" }),
	});
	const field = (
		<TextField>
			<TextArea
				variant="secondary"
				accessibilityLabel={t`Job posting`}
				placeholder={t`Paste a job posting…`}
				maxLength={MAX_POSTING_CHARS}
				value={draft}
				onChangeText={setDraft}
				testID="posting-field"
			/>
		</TextField>
	);

	if (application)
		return (
			<CheckSection icon="briefcase" title={`${application.role} · ${application.company}`}>
				<Text tone="muted">{t`This application has no posting saved yet. Paste it to match against it.`}</Text>
				{field}
				<Button
					className="self-start"
					isDisabled={!draft.trim() || save.isPending || offline}
					onPress={() => save.mutate({ id: application.id, jobDescription: draft.trim() })}
				>
					<Button.Label>{t`Save to the application`}</Button.Label>
				</Button>
			</CheckSection>
		);

	return (
		<CheckSection icon="briefcase" title={t`Match against a job`}>
			<Text tone="muted">{t`This resume isn't linked to an application yet.`}</Text>
			<Button variant="secondary" isDisabled={locked || offline || linking} onPress={() => setPicking(true)}>
				<Button.Label>{linking ? t`Linking…` : t`Link an application…`}</Button.Label>
			</Button>
			{/* Two ways in: link an application, or paste a posting. */}
			<View className="flex-row items-center gap-3">
				<Separator className="flex-1" />
				<Text size="xs" tone="muted">{t`or`}</Text>
				<Separator className="flex-1" />
			</View>
			{field}
			<Button className="self-start" isDisabled={!draft.trim()} onPress={() => onPaste(draft)} testID="posting-match">
				<Button.Label>{t`Match this posting`}</Button.Label>
			</Button>
			<Text size="xs" tone="muted">{t`A pasted posting can be saved as an application afterwards.`}</Text>
			<ApplicationPicker isOpen={picking} onOpenChange={setPicking} value={null} onPick={(next) => void link(next)} />
		</CheckSection>
	);
}
