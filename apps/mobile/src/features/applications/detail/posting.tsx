// The saved posting: its link (opens in the browser), where the text came from, what it asks for, and the job
// description folded to a few lines, editable in a sheet.
import type { Application } from "../types";
import { useLingui } from "@lingui/react/macro";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { useUserTime } from "../date";
import { useApplicationMutations } from "../queries";
import { FormField } from "./form-field";
import { DetailSection } from "./section";
import { Alert, Button, Chip, Icon, Sheet, Text, Typography, showToast } from "@/ui";

type PostingProps = { application: Application };

export const openPosting = (url: string, failed: string) => {
	if (!/^https?:\/\//i.test(url)) return;
	void openBrowserAsync(url).catch(() => showToast({ title: failed, variant: "danger" }));
};

export function Posting({ application }: PostingProps) {
	const { t } = useLingui();
	const { date } = useUserTime();
	const [expanded, setExpanded] = useState(false);
	const [editing, setEditing] = useState(false);
	const { sourceUrl, jobDescription, postingSource: source, requirements } = application;
	if (!sourceUrl && !jobDescription && requirements.length === 0) return null;
	const clipped = source?.truncated || source?.completeness === "incomplete";

	return (
		<DetailSection
			title={t`Job posting`}
			testID="posting"
			action={
				<Button size="sm" variant="ghost" onPress={() => setEditing(true)} testID="posting-edit">
					<Icon name="pencil-simple" size={16} />
					<Button.Label>{t`Edit`}</Button.Label>
				</Button>
			}
		>
			{sourceUrl ? (
				<Button
					size="sm"
					variant="secondary"
					className="self-start"
					accessibilityHint={t`Opens in the browser`}
					onPress={() => openPosting(sourceUrl, t`Couldn't open the posting. Try again.`)}
					testID="posting-open"
				>
					<Button.Label>{t`Open the posting`}</Button.Label>
					<Icon name="arrow-square-out" size={16} />
				</Button>
			) : null}
			{source && source.method !== "paste" && source.retrievedAt ? (
				<Text size="xs" tone="muted">
					{t`Saved from the page on ${date(source.retrievedAt)}. It may have changed since.`}
				</Text>
			) : null}
			{clipped ? (
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>{t`This description is clipped or incomplete. Check it before preparing documents.`}</Alert.Title>
					</Alert.Content>
				</Alert>
			) : null}
			{requirements.length > 0 ? (
				<View className="flex-row flex-wrap gap-1.5" accessibilityLabel={t`What it asks for`}>
					{requirements.map((requirement) => (
						<Chip key={requirement} size="sm" variant="soft" color="default">
							<Chip.Label>{requirement}</Chip.Label>
						</Chip>
					))}
				</View>
			) : null}
			{jobDescription ? (
				<View className="gap-1">
					<Typography type="body-sm" numberOfLines={expanded ? undefined : 6} selectable testID="posting-text">
						{jobDescription}
					</Typography>
					<Button
						size="sm"
						variant="ghost"
						className="self-start px-0"
						accessibilityState={{ expanded }}
						onPress={() => setExpanded((value) => !value)}
					>
						<Button.Label>{expanded ? t`Show less` : t`Show the whole description`}</Button.Label>
					</Button>
				</View>
			) : null}
			<Sheet
				isOpen={editing}
				onOpenChange={setEditing}
				title={t`Job description`}
				closeLabel={t`Close`}
				detents={[0.9]}
			>
				{editing ? <DescriptionForm application={application} onDone={() => setEditing(false)} /> : null}
			</Sheet>
		</DetailSection>
	);
}

type DescriptionFormProps = { application: Application; onDone: () => void };

function DescriptionForm({ application, onDone }: DescriptionFormProps) {
	const { t } = useLingui();
	const { update } = useApplicationMutations();
	const [text, setText] = useState(application.jobDescription ?? "");
	return (
		<View className="gap-4 pb-2">
			<FormField label={t`Job description`} value={text} onChangeText={setText} multiline maxLength={20_000} />
			<Button
				variant="primary"
				isDisabled={update.isPending || text === (application.jobDescription ?? "")}
				onPress={() =>
					update.mutate(
						{ id: application.id, jobDescription: text.trim() ? text : null },
						{
							onSuccess: onDone,
							onError: () => showToast({ title: t`Couldn't save the job description. Try again.`, variant: "danger" }),
						},
					)
				}
			>
				<Button.Label>{t`Save changes`}</Button.Label>
			</Button>
		</View>
	);
}
