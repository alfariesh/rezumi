// New → Copy a resume for a job: a resume to start from, the job it's for (optional) and the copy's name. Each choice
// opens a list inside the same sheet. A copy made for a job opens with the assistant ready to tailor it.
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useDocuments } from "./queries";
import { orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { Button, EmptyState, Input, Label, ListRow, ListSection, TextField, Typography } from "@/ui";

type Picking = "source" | "job" | null;

type NewCopyProps = {
	initialSourceId?: string | undefined;
	initialJobId?: string | undefined;
	busy: boolean;
	onCreate: (input: { resumeId: string; name: string; applicationId?: string | undefined }) => void;
	/** Back to New's choices; while a list is open, Back closes it instead. */
	onBack: () => void;
};

export function NewCopy(props: NewCopyProps) {
	const { t } = useLingui();
	const [picking, setPicking] = useState<Picking>(null);
	return (
		<View className="gap-4">
			<CopyForm {...props} picking={picking} onPickingChange={setPicking} />
			<Button
				variant="ghost"
				isDisabled={props.busy}
				onPress={() => (picking ? setPicking(null) : props.onBack())}
				testID="new-copy-back"
			>
				<Button.Label>{t`Back`}</Button.Label>
			</Button>
		</View>
	);
}

type CopyFormProps = NewCopyProps & { picking: Picking; onPickingChange: (picking: Picking) => void };

function CopyForm({
	initialSourceId,
	initialJobId,
	busy,
	onCreate,
	picking,
	onPickingChange: setPicking,
}: CopyFormProps) {
	const { t } = useLingui();
	const session = useSession();
	const documents = useDocuments();
	const options = orpc.applications.listSummary.queryOptions({ input: {} });
	const applications = useQuery({
		...options,
		queryKey: [...options.queryKey, session.server],
		enabled: session.status === "signed-in",
	});
	const [sourceId, setSourceId] = useState(initialSourceId ?? null);
	const [jobId, setJobId] = useState(initialJobId ?? null);
	const [name, setName] = useState<string | null>(null);
	const resumes = (documents.data ?? [])
		.filter((document) => document.type === "resume")
		.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
	const source = resumes.find((document) => document.id === sourceId) ?? resumes[0];
	// Closed applications stay out, except the one New was opened from.
	const jobs = (applications.data ?? []).filter(
		(application) => application.status !== "closed" || application.id === initialJobId,
	);
	const job = jobs.find((application) => application.id === jobId);
	const suggested = (
		job ? `${source?.name.split(" — ")[0] ?? ""} — ${job.company}` : t`${source?.name ?? ""} (copy)`
	).slice(0, 100);
	const value = name ?? suggested;

	if (picking === "source")
		return (
			<ListSection title={t`Start from`}>
				{resumes.map((document) => (
					<ListRow
						key={document.id}
						icon="file-text"
						title={document.name}
						isSelected={document.id === source?.id}
						chevron={false}
						onPress={() => {
							setSourceId(document.id);
							setName(null);
							setPicking(null);
						}}
					/>
				))}
			</ListSection>
		);
	if (picking === "job")
		return (
			<ListSection title={t`For which job?`}>
				<ListRow
					title={t`No job yet`}
					isSelected={!job}
					chevron={false}
					onPress={() => {
						setJobId(null);
						setName(null);
						setPicking(null);
					}}
				/>
				{jobs.map((application) => (
					<ListRow
						key={application.id}
						icon="briefcase"
						title={application.role}
						description={application.company}
						isSelected={application.id === job?.id}
						chevron={false}
						onPress={() => {
							setJobId(application.id);
							setName(null);
							setPicking(null);
						}}
					/>
				))}
			</ListSection>
		);

	if (documents.isError && !documents.data)
		return (
			<EmptyState
				kind="inline"
				title={t`Couldn't load resumes.`}
				action={{ label: t`Retry`, onPress: () => void documents.refetch() }}
			/>
		);
	if (documents.data && resumes.length === 0)
		return (
			<EmptyState kind="inline" title={t`Create or import a resume first, then return to copy it for this job.`} />
		);

	return (
		<View className="gap-4">
			<Typography type="body-sm" color="muted">
				{t`Start from one you have and link the application.`}
			</Typography>
			<ListSection>
				<ListRow
					title={t`Start from`}
					value={source?.name ?? ""}
					isDisabled={busy || !documents.data}
					onPress={() => setPicking("source")}
				/>
				<ListRow
					title={t`For which job?`}
					value={job ? job.company : t`No job yet`}
					description={applications.isError ? t`Couldn't load applications.` : undefined}
					isDisabled={busy || !applications.data}
					onPress={() => setPicking("job")}
				/>
			</ListSection>
			<TextField isDisabled={busy}>
				<Label>{t`Name`}</Label>
				<Input variant="secondary" value={value} onChangeText={setName} maxLength={100} accessibilityLabel={t`Name`} />
			</TextField>
			<Button
				isDisabled={busy || !source || !value.trim()}
				onPress={() => {
					if (source) onCreate({ resumeId: source.id, name: value.trim(), applicationId: job?.id });
				}}
			>
				<Button.Label>{t`Create copy`}</Button.Label>
			</Button>
		</View>
	);
}
