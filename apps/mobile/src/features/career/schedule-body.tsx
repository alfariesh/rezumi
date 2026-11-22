// The schedule sheet's content: loading and failure, then the fields of the kind being set up, when it runs, its
// switches, and why saving didn't happen.
import type { Draft } from "./schedule-fields";
import type { collectInterviews } from "./scheduling";
import type { useHasAIProvider } from "@/features/ai/provider-state";
import type { ApplicationSummary } from "@/features/applications/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { JobAlertFields, KindChoice, Note, PickRow, ScheduleSwitches, WhenFields } from "./schedule-fields";
import { toZoned } from "./scheduling";
import { routes } from "@/routes";
import { Button, Label, Segment, Skeleton, Text } from "@/ui";

type Interview = ReturnType<typeof collectInterviews>[number];
type Ai = ReturnType<typeof useHasAIProvider>;

export type ScheduleBodyProps = {
	draft: Draft | null;
	set: (patch: Partial<Draft>) => void;
	isNew: boolean;
	/** A read that failed before the form could start. */
	failed: { refetch: () => unknown } | null;
	timeZone: string;
	locale: string;
	now: Date;
	upcoming: Interview[];
	open: ApplicationSummary[];
	interview: Interview | undefined;
	/** When it runs: the briefing's time from the interview, otherwise the date and time entered. */
	runAt: Date | null;
	ai: Ai;
	/** A briefing whose connection is gone: the connection it falls back to. */
	providerMissing: string | null;
	/** The server runs scheduled work. */
	available: boolean;
	alertsUnavailable: boolean;
	smtp: boolean;
	verified: boolean;
	email: string;
	errors: { role: string | null; when: string | null };
	onRoleBlur: () => void;
	/** The job alerts the plan keeps on, after a save was refused for that. */
	limit: number | null;
	saveError: string | null;
	onClose: () => void;
};

/** The form's shape while it loads. */
function Loading() {
	const { t } = useLingui();
	return (
		<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-4">
			<Skeleton variant="none" className="h-10 w-full rounded-xl" />
			{[0, 1, 2].map((row) => (
				<View key={row} className="gap-2">
					<Skeleton variant="none" className="h-3.5 w-32 rounded-md" />
					<Skeleton variant="none" className="h-12 w-full rounded-xl" />
				</View>
			))}
		</View>
	);
}

export function ScheduleBody(props: ScheduleBodyProps) {
	const { t } = useLingui();
	const { draft, set, failed } = props;
	if (!draft && failed)
		return (
			<>
				<Note status="danger" message={t`Couldn't load this. Check your connection and try again.`} />
				<Button variant="secondary" className="self-start" onPress={() => void failed.refetch()}>
					<Button.Label>{t`Retry`}</Button.Label>
				</Button>
			</>
		);
	if (!draft) return <Loading />;
	const max = props.limit ?? 0;
	return (
		<View className="gap-5">
			<KindChoice value={draft.kind} onChange={(kind) => set({ kind })} isDisabled={!props.isNew} />
			{props.available ? null : (
				<Note
					status="warning"
					message={t`Scheduled work is not available on this server. Ask your server administrator to configure it.`}
				/>
			)}
			{draft.kind === "discovery" ? (
				<JobAlertFields
					draft={draft}
					set={set}
					roleError={props.errors.role}
					onRoleBlur={props.onRoleBlur}
					unavailable={props.alertsUnavailable}
				/>
			) : draft.kind === "prepare" ? (
				<PrepareFields {...props} draft={draft} />
			) : (
				<FollowUpFields {...props} draft={draft} />
			)}
			{draft.kind === "prepare" ? null : (
				<WhenFields
					draft={draft}
					set={set}
					timeZone={props.timeZone}
					locale={props.locale}
					today={toZoned(props.now, props.timeZone).date}
					error={props.errors.when}
				/>
			)}
			<ScheduleSwitches draft={draft} set={set} smtp={props.smtp} verified={props.verified} email={props.email} />
			{props.limit === null ? null : (
				<Note
					status="warning"
					title={t`No room for another job alert`}
					message={plural(max, {
						one: "You can keep # job alert on. Pause or delete one to turn on another.",
						other: "You can keep up to # job alerts on. Pause or delete one to turn on another.",
					})}
				/>
			)}
			{props.saveError ? <Note status="danger" message={props.saveError} /> : null}
		</View>
	);
}

type KindFieldsProps = ScheduleBodyProps & { draft: Draft };

/** The interview, how long before it the briefing runs, and the AI connection that writes it. */
function PrepareFields({
	draft,
	set,
	upcoming,
	interview,
	runAt,
	now,
	locale,
	timeZone,
	ai,
	...props
}: KindFieldsProps) {
	const { t } = useLingui();
	const router = useRouter();
	const when = (at: Date) =>
		new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(at);
	const passed =
		draft.lead === "morning"
			? t`The morning of the interview has passed, so the briefing runs now.`
			: t`Starts in under ${draft.lead === "24h" ? 24 : 2} hours, so the briefing runs now.`;
	const runs = runAt ? (runAt <= now ? passed : t`Runs at ${when(runAt)}.`) : undefined;
	return (
		<>
			<PickRow
				title={t`Interview`}
				value={draft.interviewId}
				placeholder={t`Add an interview in an application first`}
				searchLabel={t`Search interviews`}
				isDisabled={upcoming.length === 0}
				footer={interview ? runs : undefined}
				options={upcoming.map((row) => ({
					value: row.interview.id,
					label: `${row.application.company} · ${when(row.start)}`,
				}))}
				onPick={(interviewId) => set({ interviewId })}
			/>
			<View className="gap-2">
				<Label>{t`Prepare a briefing`}</Label>
				<Segment
					accessibilityLabel={t`Prepare a briefing`}
					value={draft.lead}
					onValueChange={(lead) => set({ lead })}
					options={[
						{ value: "24h", label: t`24 hours before` },
						{ value: "2h", label: t`2 hours before` },
						{ value: "morning", label: t`Morning of` },
					]}
				/>
				<Text size="xs" tone="muted">
					{t`Morning of runs at 08:00, or two hours before interviews starting before 10:00.`}
				</Text>
			</View>
			{ai.isLoading ? (
				<Text tone="muted">{t`Loading AI connections…`}</Text>
			) : ai.error ? (
				<Button variant="secondary" className="self-start" onPress={ai.retry}>
					<Button.Label>{t`Retry AI connections`}</Button.Label>
				</Button>
			) : ai.usableProviders.length === 0 ? (
				<Button
					variant="secondary"
					className="self-start"
					onPress={() => {
						props.onClose();
						router.push(routes.account("ai-providers"));
					}}
				>
					<Button.Label>{t`Connect an AI provider in Settings`}</Button.Label>
				</Button>
			) : (
				<PickRow
					title={t`AI connection`}
					value={draft.aiProviderId}
					placeholder={ai.defaultProvider?.label ?? ""}
					searchLabel={t`Search connections`}
					footer={
						props.providerMissing === null
							? undefined
							: t`Its connection was switched off or removed, so it runs on ${props.providerMissing} until you choose another.`
					}
					options={ai.usableProviders.map((row) => ({ value: row.id, label: row.label }))}
					onPick={(aiProviderId) => set({ aiProviderId })}
				/>
			)}
			<Text size="xs" tone="muted">
				{t`Sends this application's posting, notes and documents, plus your Profile (details, career, and the facts and stories that are switched on), to this connection. Your provider may charge for it.`}
			</Text>
		</>
	);
}

/** The application to follow up on. */
function FollowUpFields({ draft, set, open }: KindFieldsProps) {
	const { t } = useLingui();
	return (
		<PickRow
			title={t`Application`}
			value={draft.applicationId}
			placeholder={t`Add an application first`}
			searchLabel={t`Search applications`}
			isDisabled={open.length === 0}
			options={open.map((row) => ({ value: row.id, label: `${row.company} · ${row.role}` }))}
			onPick={(applicationId) => set({ applicationId })}
		/>
	);
}
