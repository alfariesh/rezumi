// The steps a library document's menu opens inside its own sheet: Rename, Tags and (for letters) Link to application.
import type { DocumentSummary } from "./filter";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import {
	Button,
	ChipInput,
	EmptyState,
	Input,
	Label,
	ListRow,
	ListSection,
	Skeleton,
	TextField,
	Typography,
} from "@/ui";

type RenamePanelProps = { name: string; busy: boolean; onSave: (name: string) => void };

export function RenamePanel({ name: initial, busy, onSave }: RenamePanelProps) {
	const { t } = useLingui();
	const [name, setName] = useState(initial);
	return (
		<View className="gap-4">
			<TextField isDisabled={busy}>
				<Label>{t`Name`}</Label>
				<Input
					variant="secondary"
					value={name}
					onChangeText={setName}
					maxLength={100}
					autoFocus
					selectTextOnFocus
					returnKeyType="done"
					onSubmitEditing={() => onSave(name)}
					accessibilityLabel={t`Name`}
				/>
			</TextField>
			<Button isDisabled={busy || !name.trim()} onPress={() => onSave(name)}>
				<Button.Label>{t`Save`}</Button.Label>
			</Button>
		</View>
	);
}

type TagsPanelProps = { document: DocumentSummary; busy: boolean; onSave: (tags: string[]) => void };

/** Tags… for one document: tags group documents in the library; pick one above the list to filter by it. */
export function TagsPanel({ document, busy, onSave }: TagsPanelProps) {
	const { t } = useLingui();
	const [tags, setTags] = useState(() => [...document.tags]);
	return (
		<View className="gap-4">
			<Typography type="body-sm" color="muted">
				{t`Tags group documents in the library; pick one above the list to filter by it.`}
			</Typography>
			<ChipInput
				label={t`Tags`}
				values={tags}
				onChange={setTags}
				removeLabel={(tag) => t`Remove ${tag}`}
				placeholder={t`Add a tag`}
				description={t`Up to 20 tags per document, 40 characters per tag.`}
				max={20}
				maxLength={40}
				variant="secondary"
			/>
			<Button isDisabled={busy} onPress={() => onSave(tags)}>
				<Button.Label>{t`Save tags`}</Button.Label>
			</Button>
		</View>
	);
}

type LinkPanelProps = { document: DocumentSummary; busy: boolean; onLink: (applicationId: string | null) => void };

/** Link to application… for letters: the job the letter is for. */
export function LinkPanel({ document, busy, onLink }: LinkPanelProps) {
	const { t } = useLingui();
	const session = useSession();
	const options = orpc.applications.listSummary.queryOptions({ input: {} });
	const applications = useQuery({
		...options,
		queryKey: [...options.queryKey, session.server],
		enabled: session.status === "signed-in",
	});
	// Closed applications stay out, except the one the letter is already linked to.
	const jobs = (applications.data ?? []).filter(
		(application) => application.status !== "closed" || application.id === document.application?.id,
	);
	return (
		<View className="gap-4">
			<Typography type="body-sm" color="muted">
				{t`The application this letter is for.`}
			</Typography>
			{applications.isError && !applications.data ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load applications.`}
					action={{ label: t`Retry`, onPress: () => void applications.refetch() }}
				/>
			) : !applications.data ? (
				<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-2">
					<Skeleton variant="none" className="h-14 rounded-xl" />
					<Skeleton variant="none" className="h-14 rounded-xl" />
				</View>
			) : jobs.length === 0 ? (
				<EmptyState kind="inline" title={t`No applications yet. Add one in Applications first.`} />
			) : (
				<ListSection>
					{jobs.map((application) => (
						<ListRow
							key={application.id}
							icon="briefcase"
							title={application.role}
							description={application.company}
							isSelected={document.application?.id === application.id}
							isDisabled={busy}
							onPress={() => onLink(application.id)}
							chevron={false}
						/>
					))}
				</ListSection>
			)}
			{document.application ? (
				<Button variant="ghost" isDisabled={busy} onPress={() => onLink(null)}>
					<Button.Label>{t`Unlink`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}
