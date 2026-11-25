import type { ToolPart } from "@rezumi/ai/assistant-proposals";
import type { Proposal, ProposalState } from "@rezumi/resume/proposals";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { Linking, View } from "react-native";
import { isProposeEdits, skippedCount, toProposals } from "@rezumi/ai/assistant-proposals";
import { agentWebSources } from "@rezumi/ai/tools/agent-tool-contracts";
import { ChangeSet } from "./change-set";
import { AssistantMarkdown } from "./markdown";
import { client, orpc } from "@/api/client";
import { ReportAiContent } from "@/features/ai/report-content";
import { Button, Icon, IconButton, Input, Spinner, Text, showToast } from "@/ui";

export type EditStatus = Proposal["status"];

/** What the chat can do with proposed edits: present only when it's about a document. */
export type ProposalHandlers = {
	statuses: ReadonlyMap<string, EditStatus>;
	stateOf: (proposal: Proposal) => ProposalState;
	locked: boolean;
	onAccept: (message: UIMessage, part: ToolPart, proposals: readonly Proposal[]) => void;
	onReject: (message: UIMessage, part: ToolPart, proposals: readonly Proposal[]) => void;
	undo: React.ComponentProps<typeof ChangeSet>["undo"];
};

type MessageViewProps = {
	message: UIMessage;
	streaming: boolean;
	readOnly: boolean;
	proposals: ProposalHandlers | null;
	/** Null while an answer can't continue the reply (context left out): the question asks for a new message instead. */
	onAnswer: ((toolCallId: string, answer: string) => void) | null;
};

/** Memoized: while a reply streams, only its own message re-renders; the ones above keep their props. */
export const MessageView = memo(function MessageView({
	message,
	streaming,
	readOnly,
	proposals,
	onAnswer,
}: MessageViewProps) {
	const { t } = useLingui();

	if (message.role === "user") {
		const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const files = message.parts.flatMap((part) => (part.type === "file" ? [part] : []));
		return (
			<View className="ms-8 items-end gap-1">
				{text ? (
					<View className="rounded-xl rounded-ee-sm bg-surface-secondary px-3 py-2">
						<Text selectable>{text}</Text>
					</View>
				) : null}
				{files.map((file) => (
					<FileChip key={file.url} name={file.filename ?? t`Attachment`} />
				))}
			</View>
		);
	}

	const sources = agentWebSources(message);
	const reportText = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");

	return (
		<View className="gap-3">
			{message.parts.map((part, index) => {
				const key = `${message.id}-${index}`;
				if (part.type === "text")
					return (
						<View key={key}>
							<AssistantMarkdown text={part.text} />
						</View>
					);
				return (
					<ToolPartView
						key={key}
						part={part as ToolPart}
						message={message}
						streaming={streaming}
						readOnly={readOnly}
						proposals={proposals}
						onAnswer={onAnswer}
					/>
				);
			})}
			{!streaming && reportText.trim() ? <ReportAiContent source="assistant" text={reportText} fromMenu /> : null}
			{sources.length > 0 ? (
				<View className="gap-1">
					<Text size="xs" tone="muted">
						<Trans>Sources</Trans>
					</Text>
					{sources.map((source) => (
						<Text
							key={source.url}

							tone="accent"
							numberOfLines={1}
							accessibilityRole="link"
							onPress={() => void Linking.openURL(source.url)}
							className="underline"
						>
							{source.title}
						</Text>
					))}
				</View>
			) : null}
		</View>
	);
});

type FileChipProps = { name: string; busy?: boolean | undefined; onRemove?: (() => void) | undefined };

export function FileChip({ name, busy, onRemove }: FileChipProps) {
	const { t } = useLingui();
	return (
		<View className="min-h-8 max-w-48 flex-row items-center gap-1 rounded-full bg-surface-secondary px-2">
			{busy ? <Spinner size="sm" /> : <Icon name="paperclip" size={16} tone="muted" />}
			<Text size="xs" tone="muted" numberOfLines={1} className="shrink">
				{name}
			</Text>
			{onRemove ? <IconButton icon="x" label={t`Remove ${name}`} size="sm" onPress={onRemove} /> : null}
		</View>
	);
}

type StatusProps = { status?: "running" | "error" | "pending" | undefined; children: ReactNode };

export function Status({ status, children }: StatusProps) {
	return (
		<View accessibilityRole={status === "error" ? "alert" : undefined} className="flex-row items-center gap-2">
			{status === "running" ? (
				<Spinner size="sm" />
			) : (
				<Icon
					name={status === "error" ? "warning-circle" : status === "pending" ? "minus" : "check"}
					size={16}
					tone={status === "error" ? "danger" : "muted"}
				/>
			)}
			<Text size="xs" tone={status === "error" ? "danger" : "muted"} className="shrink">
				{children}
			</Text>
		</View>
	);
}

type ToolPartViewProps = Omit<MessageViewProps, "message"> & { part: ToolPart; message: UIMessage };

function ToolPartView({ part, message, streaming, readOnly, proposals, onAnswer }: ToolPartViewProps) {
	const working = part.state === "input-streaming" || part.state === "input-available";
	if (part.state === "approval-requested" || part.state === "approval-responded") return null;
	if (part.state === "output-denied")
		return (
			<Status>
				<Trans>Skipped</Trans>
			</Status>
		);

	switch (part.type) {
		case "tool-read_resume":
		case "tool-read_letter":
			return (
				<Status status={working ? "running" : undefined}>
					{part.type === "tool-read_letter" ? <Trans>Read the letter</Trans> : <Trans>Read the resume</Trans>}
				</Status>
			);
		case "tool-read_attachment":
			return (
				<Status status={working ? "running" : undefined}>
					<Trans>Read the attachment</Trans>
				</Status>
			);
		case "tool-web_search":
		case "tool-google_search":
		case "tool-search_web":
		case "tool-read_page": {
			const reading = part.type === "tool-read_page";
			if (working && !streaming)
				return (
					<Status status="pending">
						{reading ? <Trans>Page reading didn't finish.</Trans> : <Trans>Web search didn't finish.</Trans>}
					</Status>
				);
			if (part.state === "output-error")
				return (
					<Status status="error">
						{reading ? (
							<Trans>Couldn't read this page: {part.errorText}</Trans>
						) : (
							<Trans>Web search failed: {part.errorText}</Trans>
						)}
					</Status>
				);
			const page = reading
				? (part.output as { truncated?: unknown; completeness?: unknown; fallbackReason?: unknown })
				: null;
			return (
				<View className="gap-1">
					<Status status={working ? "running" : undefined}>
						{reading ? (
							working ? (
								<Trans>Reading page…</Trans>
							) : (
								<Trans>Read the page</Trans>
							)
						) : working ? (
							<Trans>Searching the web…</Trans>
						) : (
							<Trans>Searched the web</Trans>
						)}
					</Status>
					{page && (page.truncated === true || page.completeness === "incomplete") ? (
						<Text size="xs" tone="muted">
							<Trans>This page is clipped or incomplete. Check the original before using it.</Trans>
						</Text>
					) : null}
					{page && typeof page.fallbackReason === "string" ? (
						<Text size="xs" tone="muted">
							<Trans>Enhanced reading unavailable; used the built-in reader.</Trans>
						</Text>
					) : null}
				</View>
			);
		}
		case "tool-apply_resume_patch":
			return (
				<Status>
					<Trans>Changed the resume directly (an earlier conversation)</Trans>
				</Status>
			);
		case "tool-ask_user_question":
			return <QuestionCard part={part} readOnly={readOnly} onAnswer={onAnswer} />;
		case "tool-propose_edits": {
			if (part.state === "output-error")
				return (
					<Status status="error">
						<Trans>Couldn't propose these edits: {part.errorText}</Trans>
					</Status>
				);
			if (!isProposeEdits(part))
				return (
					<Status status="running">
						<Trans>Preparing edits…</Trans>
					</Status>
				);
			if (!proposals) return null;
			const list = toProposals(part, proposals.statuses);
			const skipped = skippedCount(part);
			return (
				<View className="gap-2">
					{list.length > 0 ? (
						<ChangeSet
							proposals={list}
							states={list.map(proposals.stateOf)}
							locked={readOnly || proposals.locked || streaming}
							undo={proposals.undo}
							onAccept={(chosen) => proposals.onAccept(message, part, chosen)}
							onReject={(chosen) => proposals.onReject(message, part, chosen)}
						/>
					) : null}
					{skipped > 0 ? (
						<Text size="xs" tone="muted">
							{plural(skipped, {
								one: "# edit couldn't be placed: its text changed. Ask again to redo it.",
								other: "# edits couldn't be placed: their text changed. Ask again to redo them.",
							})}
						</Text>
					) : null}
				</View>
			);
		}
		case "tool-save_story": {
			const story = part.output as { data?: { title?: unknown } } | undefined;
			const title = typeof story?.data?.title === "string" ? story.data.title : null;
			return part.state === "output-available" && title ? (
				<Status>
					<Trans>Saved a story: {title}</Trans>
				</Status>
			) : null;
		}
		case "tool-remember_fact":
			return streaming ? null : <RememberNote part={part} />;
		default:
			return null;
	}
}

type QuestionCardProps = Pick<MessageViewProps, "readOnly" | "onAnswer"> & { part: ToolPart };

/** The assistant asks before writing anything the document doesn't say: an info-soft card with its choices. */
function QuestionCard({ part, readOnly, onAnswer }: QuestionCardProps) {
	const { t } = useLingui();
	const [other, setOther] = useState("");
	const input = (part.input ?? {}) as { question?: unknown; choices?: unknown };
	const question = typeof input.question === "string" ? input.question : "";
	const choices = Array.isArray(input.choices)
		? input.choices.filter((choice): choice is string => typeof choice === "string")
		: [];
	const answer = part.state === "output-available" && typeof part.output === "string" ? part.output : null;
	const toolCallId = part.toolCallId;
	if (!question) return null;

	return (
		<View className="gap-3 rounded-xl bg-accent-soft p-3">
			<Text weight="semibold" tone="accent">
				{question}
			</Text>
			{answer !== null ? (
				<Text tone="accent">
					<Trans>You answered: {answer}</Trans>
				</Text>
			) : readOnly || !toolCallId ? null : !onAnswer ? (
				<Text tone="accent">
					<Trans>Context is left out, so reply with a new message instead.</Trans>
				</Text>
			) : (
				<>
					{choices.length > 0 ? (
						<View className="flex-row flex-wrap gap-2">
							{choices.map((choice) => (
								<Button key={choice} variant="secondary" onPress={() => onAnswer(toolCallId, choice)}>
									<Button.Label>{choice}</Button.Label>
								</Button>
							))}
						</View>
					) : null}
					<View className="flex-row items-center gap-2">
						<Input
							value={other}
							onChangeText={setOther}
							accessibilityLabel={t`Answer in your own words`}
							placeholder={t`Or in your own words…`}
							variant="secondary"
							returnKeyType="send"
							onSubmitEditing={() => other.trim() && onAnswer(toolCallId, other.trim())}
							className="flex-1"
						/>
						<Button variant="secondary" isDisabled={!other.trim()} onPress={() => onAnswer(toolCallId, other.trim())}>
							<Button.Label>
								<Trans>Send</Trans>
							</Button.Label>
						</Button>
					</View>
				</>
			)}
		</View>
	);
}

type RememberOutput = { status?: unknown; id?: unknown; fact?: { text?: unknown } };

function RememberNote({ part }: { part: ToolPart }) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [outcome, setOutcome] = useState<"pending" | "saved" | "dismissed" | "undone">("pending");
	const [busy, setBusy] = useState(false);
	const output = (part.state === "output-available" ? part.output : null) as RememberOutput | null;
	const text = typeof output?.fact?.text === "string" ? output.fact.text : null;
	if (!output || !text || outcome === "dismissed" || outcome === "undone") return null;
	const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });

	// Memory mode Automatically: already saved, with Undo.
	if (output.status === "saved" && typeof output.id === "string") {
		const id = output.id;
		return (
			<View className="flex-row flex-wrap items-center gap-2">
				<Icon name="check-circle" size={18} tone="accent" />
				<Text tone="muted" className="shrink">
					<Trans>Remembered: “{text}”</Trans>
				</Text>
				<Button
					variant="tertiary"
					onPress={() => {
						setOutcome("undone");
						client.career
							.forgetFact({ id })
							.then(refresh)
							.catch(() => {
								setOutcome("pending");
								showToast({ title: t`Couldn't undo that. Try again.` });
							});
					}}
				>
					<Button.Label>
						<Trans>Undo</Trans>
					</Button.Label>
				</Button>
			</View>
		);
	}
	if (output.status !== "proposed") return null;

	if (outcome === "saved")
		return (
			<Status>
				<Trans>Added to your Profile.</Trans>
			</Status>
		);

	return (
		<View className="gap-2 rounded-xl bg-surface-secondary p-3">
			<Text weight="semibold">
				<Trans>Remember this for future coaching?</Trans>
			</Text>
			<Text tone="muted">{text}</Text>
			<View className="flex-row gap-2">
				<Button
					size="sm"
					isDisabled={busy}
					onPress={() => {
						setBusy(true);
						client.career
							.saveFact(output.fact as Parameters<typeof client.career.saveFact>[0])
							.then(() => {
								setOutcome("saved");
								refresh();
							})
							.catch(() => showToast({ title: t`Couldn't remember that. Try again.` }))
							.finally(() => setBusy(false));
					}}
				>
					<Button.Label>
						<Trans>Remember</Trans>
					</Button.Label>
				</Button>
				<Button size="sm" variant="ghost" onPress={() => setOutcome("dismissed")}>
					<Button.Label>
						<Trans>Not now</Trans>
					</Button.Label>
				</Button>
			</View>
		</View>
	);
}
