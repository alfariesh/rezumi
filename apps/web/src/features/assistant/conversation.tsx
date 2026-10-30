import type { ChatAttachment, MessageContext } from "./chat";
import type { AssistantDocument } from "./document";
import type { PromptChip, PromptFile } from "./prompt-box";
import type { ProposeEditsOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import type { Proposal } from "@rezumi/resume/proposals";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { ChainOfThought, ChatAttachment as FileAttachment, ChatAttachmentGroup, ChatMessage } from "@heroui-pro/react";
import { Button, Input, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { memo, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { agentWebSources, readPageOutputSchema } from "@rezumi/ai/tools/agent-tool-contracts";
import { Icon } from "@rezumi/ui/components/icon";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@rezumi/ui/components/message-scroller";
import { toast } from "@rezumi/ui/components/toast";
import { TraceIcon, TraceLine, TraceTitle } from "@rezumi/ui/components/trace";
import { cn } from "@rezumi/utils/style";
import { acceptUploads, MAX_ATTACHMENTS_PER_MESSAGE } from "./attachment-limits";
import { attachmentPart, fileToBase64, transcriptOf } from "./chat";
import { AssistantMarkdown } from "./markdown";
import { MessageSources } from "./message-sources";
import { PromptBox } from "./prompt-box";
import { ToolApprovals } from "./tool-approvals";
import { useAssistantChat } from "./use-assistant-chat";
import { WaitingRow } from "./waiting-row";
import { ChangeSet } from "@/features/resume/editor/proposals/proposal-list";
import { useEditorStore } from "@/features/resume/editor/store";
import { getOrpcErrorMessage, toastError } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

type EditStatus = Proposal["status"];
type Part = UIMessage["parts"][number];
type ToolPart = Part & {
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

type ConversationProps = {
	threadId: string;
	initialMessages: UIMessage[];
	/** A reply was still streaming when the conversation opened. */
	activeRun: boolean;
	document: AssistantDocument;
	readOnly: boolean;
	providerLabel: string;
	/** A message to send as soon as the conversation opens (the first message, ⌘K Ask). */
	prompt: string | null;
	promptAttachments: ChatAttachment[];
	initialContext: MessageContext;
	onPromptSent: () => void;
	onSwitchModel: () => void;
};

/** One conversation: the thread (role="log"), change sets and questions in it, and the composer. */
export function Conversation(props: ConversationProps) {
	const { threadId, document, readOnly } = props;
	const queryClient = useQueryClient();
	const [context, setContext] = useState<MessageContext>(props.initialContext);
	const [statuses, setStatuses] = useState<ReadonlyMap<string, EditStatus>>(new Map());
	const [stopped, setStopped] = useState(false);
	// Messages already in the thread when it opens are history; only new ones rise in.
	const [initialIds] = useState(() => new Set(props.initialMessages.map((message) => message.id)));
	// A first message already shown while the conversation opened doesn't rise in a second time.
	const [fromPending] = useState(() => props.prompt !== null);

	const refresh = () =>
		void queryClient.invalidateQueries({
			queryKey: orpc.agent.threads.list.key(),
		});
	const { messages, sendMessage, status, error, clearError, regenerate, stop, addToolOutput, addToolApprovalResponse } =
		useAssistantChat({
			threadId,
			initialMessages: props.initialMessages,
			resume: props.activeRun,
			context,
			onFinish: refresh,
		});
	const streaming = status === "submitted" || status === "streaming";
	// "streaming" starts with the reply's first chunk, which can come seconds before any text or tool call; the same
	// gap opens after each tool result. Say the assistant is still working through all of it.
	const newest = messages.at(-1);
	const newestPart =
		newest?.role === "assistant" ? newest.parts.findLast((part) => part.type !== "step-start") : undefined;
	const waiting =
		status === "submitted" ||
		(status === "streaming" &&
			newest?.role === "assistant" &&
			(!newestPart ||
				(newestPart.type.startsWith("tool-") &&
					(newestPart as ToolPart).state !== "input-streaming" &&
					(newestPart as ToolPart).state !== "input-available")));
	const continuationBlocked =
		(!context.document || !context.posting) &&
		(messages.at(-1)?.metadata as { contextScope?: string } | undefined)?.contextScope !==
			JSON.stringify([context.document !== false, context.posting !== false]);

	const send = (text: string, attachments: ChatAttachment[] = []) => {
		if (streaming || readOnly) return;
		clearError();
		setStopped(false);
		const files = attachments.map(attachmentPart);
		sendMessage(files.length > 0 ? { text, files } : { text }, {
			body: { attachmentIds: attachments.map((attachment) => attachment.id) },
		});
	};

	// The first message (or ⌘K's question) goes out once the conversation is open.
	const { prompt, promptAttachments, onPromptSent } = props;
	const sentPrompt = useRef(false);
	useEffect(() => {
		if (!prompt || sentPrompt.current) return;
		sentPrompt.current = true;
		onPromptSent();
		const files = promptAttachments.map(attachmentPart);
		sendMessage(files.length > 0 ? { text: prompt, files } : { text: prompt }, {
			body: {
				attachmentIds: promptAttachments.map((attachment) => attachment.id),
			},
		});
	}, [prompt, promptAttachments, onPromptSent, sendMessage]);

	// A failed continuation (after an answer) is sent again as it was; regenerating would drop the answer.
	const retry = () => {
		if (readOnly || continuationBlocked) return;
		clearError();
		if (
			lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
			lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
		)
			void sendMessage();
		else void regenerate();
	};

	const stopReply = () => {
		setStopped(true);
		void client.agent.messages.stop({ threadId }).catch(() => undefined);
		void stop();
	};

	// Every proposed edit in the conversation, with what the user did with it: marked on the page while pending.
	const proposals = useMemo(
		() =>
			messages.flatMap((message) =>
				message.parts.flatMap((part) => (isProposeEdits(part) ? toProposals(part, statuses, document) : [])),
			),
		[messages, statuses, document],
	);
	// Published only when they change: the page canvas and every section row re-render on each publish, and a
	// streaming reply rebuilds this list on every chunk.
	const published = useRef("[]");
	useEffect(() => {
		const key = JSON.stringify(proposals);
		if (key === published.current) return;
		published.current = key;
		useEditorStore.setState({ assistantProposals: proposals });
	}, [proposals]);
	useEffect(() => () => useEditorStore.setState({ assistantProposals: [] }), []);

	const record = (message: UIMessage, part: ToolPart, changed: readonly Proposal[], next: EditStatus) => {
		setStatuses((current) => new Map([...current, ...changed.map((proposal) => [proposal.id, next] as const)]));
		if (!part.toolCallId) return;
		void client.agent.messages
			.setEditStatus({
				threadId,
				messageId: message.id,
				toolCallId: part.toolCallId,
				edits: changed.map((proposal) => ({ id: proposal.id, status: next })),
			})
			.then(refresh)
			.catch(() => undefined);
	};

	// Undoing an accepted edit makes it pending again. Only an undo (the document) or a status change can cause
	// one, so streamed chunks don't re-check every edit.
	const recordUndone = useEffectEvent(() => {
		for (const message of messages) {
			for (const part of message.parts) {
				if (!isProposeEdits(part)) continue;
				const undone = toProposals(part, statuses, document).filter(
					(proposal) => proposal.status === "accepted" && document.stateOf(proposal) === "pending",
				);
				if (undone.length > 0) record(message, part, undone, "pending");
			}
		}
	});
	// oxlint-disable-next-line react/set-state-in-effect -- an undo happens in the resume store; the new status is also saved to the thread
	useEffect(() => recordUndone(), [statuses, document]);

	const answer = (toolCallId: string, output: string) =>
		addToolOutput({ tool: "ask_user_question", toolCallId, output });

	const last = messages.at(-1);
	const proposedInLast = last?.role === "assistant" && last.parts.some(isProposeEdits);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Follows the reply only while the reader is at the latest message; a saved thread opens on its last question. */}
			<MessageScrollerProvider autoScroll defaultScrollPosition="last-anchor">
				<div className="relative min-h-0 flex-1">
					<MessageScroller>
						<MessageScrollerViewport aria-label={t`Conversation`}>
							{/* Announced when the answer is complete, not token by token. */}
							<MessageScrollerContent aria-busy={streaming} className="gap-3 py-3">
								{messages.map((message, index) => (
									<MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
										<MessageView
											message={message}
											streaming={streaming && index === messages.length - 1}
											enter={!initialIds.has(message.id) && !(fromPending && index === 0)}
											readOnly={readOnly || continuationBlocked}
											statuses={statuses}
											document={document}
											onAnswer={answer}
											onRecord={record}
										/>
										<ToolApprovals
											message={message}
											disabled={readOnly || continuationBlocked || streaming || index !== messages.length - 1}
											onDecision={(decision) => {
												void addToolApprovalResponse(decision);
											}}
										/>
									</MessageScrollerItem>
								))}

								<WaitingRow show={waiting} skipEnter={fromPending && messages.length <= 1}>
									<TraceLine status="running">
										<TraceIcon>
											<Spinner size="sm" color="current" aria-hidden />
										</TraceIcon>
										<TraceTitle>
											<Trans>Thinking…</Trans>
										</TraceTitle>
									</TraceLine>
								</WaitingRow>

								{stopped && !streaming && !proposedInLast && (
									<MessageScrollerItem>
										<p className="flex items-center gap-2 text-sm text-muted transition-opacity duration-standard ease-enter starting:opacity-0">
											<Icon name="stop-circle" size={18} />
											<Trans>Stopped. No edits were proposed.</Trans>
											<Button size="sm" variant="ghost" onPress={() => send(t`Continue`)}>
												<Trans>Continue</Trans>
											</Button>
										</p>
									</MessageScrollerItem>
								)}

								{error && !streaming && (
									<MessageScrollerItem>
										<div
											role="alert"
											className="grid gap-2 rounded-xl bg-danger-soft p-3 text-[13px] text-danger-soft-foreground transition-opacity duration-standard ease-enter starting:opacity-0"
										>
											<span className="flex gap-2">
												<Icon name="warning-circle" size={18} className="shrink-0" />
												<Trans>
													{props.providerLabel} returned “
													{getOrpcErrorMessage(error, {
														fallback: t`an error`,
														allowServerMessage: true,
													})}
													”. Your message is kept.
												</Trans>
											</span>
											<span className="flex gap-1.5">
												<Button size="sm" variant="secondary" onPress={() => retry()}>
													<Trans>Retry</Trans>
												</Button>
												<Button size="sm" variant="ghost" onPress={() => props.onSwitchModel()}>
													<Trans>Switch model</Trans>
												</Button>
											</span>
										</div>
									</MessageScrollerItem>
								)}

								{!streaming && messages.length > 0 && (
									<MessageScrollerItem className="flex justify-end transition-opacity duration-standard ease-enter starting:opacity-0">
										<Button
											size="sm"
											variant="ghost"
											className="text-muted"
											onPress={() => void copyTranscript(messages)}
										>
											<Icon name="copy" size={16} />
											<Trans>Copy transcript</Trans>
										</Button>
									</MessageScrollerItem>
								)}
							</MessageScrollerContent>
						</MessageScrollerViewport>
						<MessageScrollerButton>
							<Icon name="arrow-down" size={16} />
							<Trans>Latest</Trans>
						</MessageScrollerButton>
					</MessageScroller>
				</div>
			</MessageScrollerProvider>

			<Composer
				document={document}
				context={context}
				onContextChange={setContext}
				providerLabel={props.providerLabel}
				streaming={streaming}
				disabled={readOnly}
				threadId={threadId}
				onSend={send}
				onStop={stopReply}
			/>
		</div>
	);
}

const isProposeEdits = (part: Part): part is ToolPart =>
	part.type === "tool-propose_edits" && (part as ToolPart).state === "output-available";

function toProposals(
	part: ToolPart,
	statuses: ReadonlyMap<string, EditStatus>,
	document: AssistantDocument,
): Proposal[] {
	const output = part.output as ProposeEditsOutput | undefined;
	return (output?.edits ?? []).map((edit) => {
		const target = {
			sectionId: edit.target.sectionId,
			field: edit.target.field,
			...(edit.target.itemId === undefined ? {} : { itemId: edit.target.itemId }),
			...(edit.target.roleId === undefined ? {} : { roleId: edit.target.roleId }),
		};
		return {
			...edit,
			target,
			location: document.locationOf({ ...edit, target }) ?? edit.location,
			status: statuses.get(edit.id) ?? edit.status,
			source: "assistant",
		};
	});
}

type MessageViewProps = {
	message: UIMessage;
	streaming: boolean;
	enter: boolean;
	readOnly: boolean;
	statuses: ReadonlyMap<string, EditStatus>;
	document: AssistantDocument;
	onAnswer: (toolCallId: string, answer: string) => void;
	onRecord: (message: UIMessage, part: ToolPart, proposals: readonly Proposal[], status: EditStatus) => void;
};

/** Memoized: while a reply streams, only its own message re-renders; the ones above keep their props. */
const MessageView = memo(function MessageView({
	message,
	streaming,
	enter,
	readOnly,
	statuses,
	document,
	onAnswer,
	onRecord,
}: MessageViewProps) {
	if (message.role === "user") {
		const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
		const files = message.parts.filter((part) => part.type === "file");
		return (
			<ChatMessage.User className={cn("gap-1 ps-8", enter && ENTER_CLASS)}>
				{text && (
					<ChatMessage.Bubble className="max-w-full rounded-2xl rounded-ee-none bg-accent">
						<ChatMessage.Content className="wrap-anywhere whitespace-pre-wrap text-accent-foreground">
							{text}
						</ChatMessage.Content>
					</ChatMessage.Bubble>
				)}
				{files.length > 0 && (
					<ChatAttachmentGroup>
						{files.map((file) => (
							<FileAttachment
								key={file.url}
								name={(file as { filename?: string }).filename ?? t`Attachment`}
								mimeType={file.mediaType}
							/>
						))}
					</ChatAttachmentGroup>
				)}
			</ChatMessage.User>
		);
	}

	const sources = agentWebSources(message);

	// The quiet steps of a turn (reading, searching) fold into one group; text and cards keep their place around it.
	const blocks: Block[] = [];
	message.parts.forEach((part, index) => {
		if (part.type === "text") {
			blocks.push({ kind: "text", text: part.text, index });
			return;
		}
		if (!part.type.startsWith("tool-")) return;
		const step = stepOf(part as ToolPart, streaming);
		const last = blocks.at(-1);
		if (step && last?.kind === "steps") last.steps.push(step);
		else if (step) blocks.push({ kind: "steps", steps: [step], index });
		else blocks.push({ kind: "tool", part: part as ToolPart, index });
	});

	return (
		<ChatMessage.Assistant className="p-0">
			<ChatMessage.Body className="gap-3 pe-0">
				{blocks.map((block) => {
					const key = `${message.id}-${block.index}`;
					if (block.kind === "text")
						return (
							<ChatMessage.Content
								key={key}
								className={cn(
									"w-fit! max-w-full min-w-0 rounded-2xl rounded-ss-none bg-surface px-4 py-2.5",
									enter && ENTER_CLASS,
								)}
							>
								<AssistantMarkdown text={block.text} />
							</ChatMessage.Content>
						);
					if (block.kind === "steps")
						return (
							<StepGroup key={key} steps={block.steps} streaming={streaming} className={cn(enter && ENTER_CLASS)} />
						);
					return (
						<ToolPartView
							key={key}
							part={block.part}
							streaming={streaming}
							message={message}
							readOnly={readOnly}
							statuses={statuses}
							document={document}
							onAnswer={onAnswer}
							onRecord={onRecord}
						/>
					);
				})}
				{sources.length > 0 && <MessageSources sources={sources} />}
			</ChatMessage.Body>
		</ChatMessage.Assistant>
	);
});

type Block =
	| { kind: "text"; text: string; index: number }
	| { kind: "steps"; steps: Step[]; index: number }
	| { kind: "tool"; part: ToolPart; index: number };

type Step = { label: ReactNode; working: boolean; note?: ReactNode };

/** A quiet step the assistant took, or null when the part is a card, a failure or something to answer. */
function stepOf(part: ToolPart, streaming: boolean): Step | null {
	if (part.state === "approval-requested" || part.state === "approval-responded") return null;
	const working = part.state === "input-streaming" || part.state === "input-available";
	if (part.state === "output-denied") return { label: <Trans>Skipped</Trans>, working: false };

	switch (part.type) {
		case "tool-read_resume":
		case "tool-read_letter":
			return {
				label: part.type === "tool-read_letter" ? <Trans>Read the letter</Trans> : <Trans>Read the resume</Trans>,
				working,
			};
		case "tool-read_attachment":
			return { label: <Trans>Read the attachment</Trans>, working };
		case "tool-web_search":
		case "tool-google_search":
		case "tool-search_web":
		case "tool-read_page": {
			const reading = part.type === "tool-read_page";
			// A search that never finished, or failed, is shown on its own line.
			if ((working && !streaming) || part.state === "output-error") return null;
			const page = reading ? readPageOutputSchema.safeParse(part.output) : null;
			return {
				label: reading ? (
					working ? (
						<Trans>Reading page…</Trans>
					) : (
						<Trans>Read the page</Trans>
					)
				) : working ? (
					<Trans>Searching the web…</Trans>
				) : (
					<Trans>Searched the web</Trans>
				),
				working,
				note: (
					<>
						{page?.success && (page.data.truncated || page.data.completeness === "incomplete") && (
							<span className="block text-xs text-muted">
								<Trans>This page is clipped or incomplete. Check the original before using it.</Trans>
							</span>
						)}
						{page?.success && page.data.fallbackReason && (
							<span className="block text-xs text-muted">
								<Trans>Enhanced reading unavailable; used the built-in reader.</Trans>
							</span>
						)}
					</>
				),
			};
		}
		case "tool-apply_resume_patch":
			// Conversations from before the assistant only proposed edits.
			return { label: <Trans>Changed the resume directly (an earlier conversation)</Trans>, working: false };
		case "tool-propose_edits":
			return part.state === "output-error" || part.state === "output-available"
				? null
				: { label: <Trans>Preparing edits…</Trans>, working: true };
		default:
			return null;
	}
}

/** One collapsible line for a turn's steps: the current step (shimmering) while it works, a count once done. */
function StepGroup({
	steps,
	streaming,
	className,
}: {
	steps: Step[];
	streaming: boolean;
	className?: string | undefined;
}) {
	const running = streaming && steps.some((step) => step.working);
	const current = steps.findLast((step) => step.working) ?? steps.at(-1);

	return (
		<ChainOfThought isStreaming={running} className={cn(className)}>
			<ChainOfThought.Trigger>
				{running ? current?.label : <Plural value={steps.length} one="Took # step" other="Took # steps" />}
			</ChainOfThought.Trigger>
			<ChainOfThought.Content>
				<ChainOfThought.Steps>
					{steps.map((step, index) => (
						<ChainOfThought.Step key={index}>
							{step.label}
							{step.note}
						</ChainOfThought.Step>
					))}
				</ChainOfThought.Steps>
			</ChainOfThought.Content>
		</ChainOfThought>
	);
}

type ToolPartViewProps = Omit<MessageViewProps, "enter"> & { part: ToolPart };

function ToolPartView({
	part,
	streaming,
	message,
	readOnly,
	statuses,
	document,
	onAnswer,
	onRecord,
}: ToolPartViewProps) {
	const working = part.state === "input-streaming" || part.state === "input-available";

	switch (part.type) {
		case "tool-web_search":
		case "tool-google_search":
		case "tool-search_web":
		case "tool-read_page": {
			const reading = part.type === "tool-read_page";
			if (working && !streaming)
				return (
					<TraceLine status="pending">
						<TraceIcon>
							<Icon name="minus" size={14} />
						</TraceIcon>
						<TraceTitle>
							{reading ? <Trans>Page reading didn't finish.</Trans> : <Trans>Web search didn't finish.</Trans>}
						</TraceTitle>
					</TraceLine>
				);
			if (part.state === "output-error")
				return (
					<TraceLine role="alert" status="error">
						<TraceIcon>
							<Icon name="warning-circle" size={14} />
						</TraceIcon>
						<TraceTitle>
							{reading ? (
								<Trans>Couldn't read this page: {part.errorText}</Trans>
							) : (
								<Trans>Web search failed: {part.errorText}</Trans>
							)}
						</TraceTitle>
					</TraceLine>
				);
			return null;
		}
		case "tool-ask_user_question":
			return <QuestionCard part={part} readOnly={readOnly} onAnswer={onAnswer} />;
		case "tool-propose_edits": {
			if (part.state === "output-error")
				return (
					<TraceLine status="error">
						<TraceIcon>
							<Icon name="warning-circle" size={14} />
						</TraceIcon>
						<TraceTitle>
							<Trans>Couldn't propose these edits: {part.errorText}</Trans>
						</TraceTitle>
					</TraceLine>
				);
			if (part.state !== "output-available") return null;
			const output = part.output as ProposeEditsOutput;
			const proposals = toProposals(part, statuses, document);
			const states = proposals.map(document.stateOf);
			const pending = states.filter((state) => state === "pending").length;
			const accepted = states.filter((state) => state === "accepted").length;
			return (
				<div className="grid gap-1.5">
					{proposals.length > 0 && (
						<ChangeSet
							proposals={proposals}
							states={states}
							locked={readOnly}
							title={
								pending > 0 ? (
									<Plural value={proposals.length} one="# proposed edit" other="# proposed edits" />
								) : (
									<Trans>
										{accepted} of {proposals.length} applied
									</Trans>
								)
							}
							onAccept={(chosen) => {
								document.accept(chosen);
								onRecord(message, part, chosen, "accepted");
							}}
							onReject={(chosen) => onRecord(message, part, chosen, "rejected")}
						/>
					)}
					{output.skipped.length > 0 && (
						<p className="text-xs text-muted">
							<Plural
								value={output.skipped.length}
								one="# edit couldn't be placed: its text changed. Ask again to redo it."
								other="# edits couldn't be placed: their text changed. Ask again to redo them."
							/>
						</p>
					)}
				</div>
			);
		}
		default:
			return null;
	}
}

type QuestionCardProps = {
	part: ToolPart;
	readOnly: boolean;
	onAnswer: (toolCallId: string, answer: string) => void;
};

/** The assistant asks before writing anything the document doesn't say: an info-soft card with its choices. */
function QuestionCard({ part, readOnly, onAnswer }: QuestionCardProps) {
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
		<div className="grid gap-2.5 rounded-xl bg-accent-soft p-3 text-accent-soft-foreground">
			<p className="text-sm font-medium">{question}</p>
			{answer !== null ? (
				<p className="text-[13px] opacity-80">
					<Trans>You answered: {answer}</Trans>
				</p>
			) : readOnly || !toolCallId ? null : (
				<>
					{choices.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{choices.map((choice) => (
								<Button
									key={choice}
									size="sm"
									variant="secondary"
									className="bg-surface"
									onPress={() => onAnswer(toolCallId, choice)}
								>
									{choice}
								</Button>
							))}
						</div>
					)}
					<form
						className="flex gap-1.5"
						onSubmit={(event) => {
							event.preventDefault();
							if (other.trim()) onAnswer(toolCallId, other.trim());
						}}
					>
						<TextField
							fullWidth
							aria-label={t`Answer in your own words`}
							value={other}
							onChange={setOther}
							className="min-w-0 flex-1"
						>
							<Input placeholder={t`Or in your own words…`} />
						</TextField>
						<Button type="submit" size="sm" isDisabled={!other.trim()}>
							<Trans>Send</Trans>
						</Button>
					</form>
				</>
			)}
		</div>
	);
}

type ComposerProps = {
	document: AssistantDocument;
	context: MessageContext;
	onContextChange: (context: MessageContext) => void;
	providerLabel: string;
	streaming: boolean;
	disabled: boolean;
	/** Attachments need a conversation to belong to. */
	threadId: string | null;
	/** Creates a draft conversation lazily for the first attachment. */
	ensureThread?: () => Promise<string>;
	onSend: (text: string, attachments?: ChatAttachment[]) => void;
	onStop: () => void;
	/** Text the box starts with (a link's `?ask=`); the user still presses Send. */
	initialText?: string | undefined;
};

/**
 * Context chips (removing one leaves it out of what's sent), the message box (Send, Stop while a reply streams) and
 * the line saying what's sent where.
 */
export function Composer(props: ComposerProps) {
	const { document, context, onContextChange, streaming, disabled } = props;
	const [text, setText] = useState(props.initialText ?? "");
	const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
	const [uploading, setUploading] = useState(false);
	const hasText = text.trim().length > 0;

	const submit = () => {
		if (!hasText || streaming || disabled || uploading) return;
		props.onSend(text.trim(), attachments);
		setText("");
		setAttachments([]);
	};

	const upload = async (chosen: File[]) => {
		const files = acceptUploads(chosen, attachments.length);
		if (files.length === 0) return;
		setUploading(true);
		try {
			const threadId = props.threadId ?? (await props.ensureThread?.());
			if (!threadId) return;
			const uploaded = await Promise.all(
				files.map(async (file) => {
					const attachment = await client.agent.attachments.create({
						threadId,
						filename: file.name,
						mediaType: file.type || "application/octet-stream",
						data: await fileToBase64(file),
					});
					return {
						id: attachment.id,
						filename: attachment.filename,
						mediaType: attachment.mediaType,
					};
				}),
			);
			setAttachments((current) => [...current, ...uploaded]);
		} catch (error) {
			toastError(error, t`Couldn't attach the file. Try again.`);
		} finally {
			setUploading(false);
		}
	};

	const chips: PromptChip[] = [
		{
			key: "document" as const,
			icon: document.kind === "letter" ? ("envelope-simple" as const) : ("file-text" as const),
			label: document.name,
		},
		...(document.posting
			? [
					{
						key: "posting" as const,
						icon: "briefcase" as const,
						label: t`${document.posting.company} posting`,
					},
				]
			: []),
	]
		.filter((chip) => context[chip.key])
		.map((chip) => ({
			...chip,
			removeLabel: t`Don't send ${chip.label}`,
			onRemove: () => onContextChange({ ...context, [chip.key]: false }),
		}));
	const files: PromptFile[] = attachments.map((attachment) => ({
		key: attachment.id,
		name: attachment.filename,
		mimeType: attachment.mediaType,
		removeLabel: t`Remove ${attachment.filename}`,
		onRemove: () => setAttachments((current) => current.filter((item) => item.id !== attachment.id)),
	}));

	return (
		<div className="pt-2">
			<PromptBox
				value={text}
				onValueChange={setText}
				onSubmit={submit}
				onStop={props.onStop}
				streaming={streaming}
				disabled={disabled}
				canSend={hasText && !uploading}
				placeholder={t`Ask, or describe a change…`}
				label={t`Message the assistant`}
				maxHeight={160}
				variant="primary"
				chips={chips}
				files={files}
				attach={
					props.threadId || props.ensureThread
						? {
								isDisabled: disabled || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE,
								isPending: uploading,
								onFiles: (files) => void upload(files),
							}
						: undefined
				}
			/>
		</div>
	);
}

async function copyTranscript(messages: readonly UIMessage[]) {
	try {
		await navigator.clipboard.writeText(
			transcriptOf(messages, {
				user: t`You`,
				assistant: t`Assistant`,
				sources: t`Sources`,
			}),
		);
		toast.add({ description: t`Transcript copied` });
	} catch {
		toast.add({ description: t`Couldn't copy the transcript. Try again.` });
	}
}
