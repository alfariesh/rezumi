import type { ChatAttachment, MessageContext } from "./chat";
import type { SessionProps } from "./chat-view";
import type { EditStatus, ProposalHandlers } from "./messages";
import type { SavedThread } from "./recovery";
import type { ToolPart } from "@rezumi/ai/assistant-proposals";
import type { Proposal } from "@rezumi/resume/proposals";
import type { UIMessage } from "ai";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { isProposeEdits, toProposals } from "@rezumi/ai/assistant-proposals";
import { attachmentPart, refreshThreads, useAssistantChat } from "./chat";
import { publishProposals } from "./proposals";
import { createRequestLane, recoverRun } from "./recovery";
import { client, orpc } from "@/api/client";
import { showToast } from "@/ui";

export type ConversationProps = SessionProps & { initialMessages: UIMessage[]; activeRun: boolean; readOnly: boolean };

export function useConversation(props: ConversationProps) {
	const { threadId, document } = props;
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [statuses, setStatuses] = useState<ReadonlyMap<string, EditStatus>>(new Map());
	const [undo, setUndo] = useState<ProposalHandlers["undo"]>(null);
	const [stopped, setStopped] = useState(false);
	const stopRequest = useRef<Promise<unknown>>(Promise.resolve());
	const statusRequest = useRef<Promise<unknown>>(Promise.resolve());
	const beforeSend = async (context: MessageContext) => {
		await stopRequest.current;
		return !context.document || !document || document.flush();
	};

	const refresh = () => {
		refreshThreads(queryClient);
		props.onFinish?.();
	};
	const chat = useAssistantChat({
		threadId,
		initialMessages: props.initialMessages,
		context: props.context,
		onFinish: refresh,
		scope: props.scope,
		beforeSend,
	});
	const {
		messages,
		sendMessage,
		setMessages,
		status,
		error,
		clearError,
		regenerate,
		addToolOutput,
		addToolApprovalResponse,
		resumeStream,
	} = chat;
	const streaming = status === "submitted" || status === "streaming";
	const readOnly = props.readOnly || props.disabled === true;

	// One request at a time: sends, retries, the automatic continuation after an answer and recovery share a lane, so
	// streams never overlap; each new request cancels and awaits the previous one, and Stop aborts all of them.
	const { instance } = chat;
	const lane = useMemo(
		() =>
			createRequestLane({
				stop: () => instance.stop(),
				busy: () => instance.status === "submitted" || instance.status === "streaming",
			}),
		[instance],
	);
	const detaching = useRef<Promise<void> | null>(null);

	const deliver = (text: string, attachments: ChatAttachment[]) => {
		const files = attachments.map(attachmentPart);
		void lane.run(() =>
			sendMessage(files.length > 0 ? { text, files } : { text }, {
				body: { attachmentIds: attachments.map((attachment) => attachment.id) },
			}),
		);
		// The server titles the conversation from its first message.
		setTimeout(() => refreshThreads(queryClient), 1500);
	};

	const send = (text: string, attachments: ChatAttachment[] = []) => {
		if (streaming || readOnly || lane.busy()) return false;
		clearError();
		setStopped(false);
		deliver(text, attachments);
		return true;
	};

	// The first message of a new conversation goes out once the chat exists.
	const sendPrompt = useEffectEvent((prompt: NonNullable<SessionProps["prompt"]>) => {
		props.onPromptDelivered();
		deliver(prompt.text, prompt.attachments);
	});
	const sentPrompt = useRef(false);
	useEffect(() => {
		if (!props.prompt || sentPrompt.current) return;
		sentPrompt.current = true;
		sendPrompt(props.prompt);
	}, [props.prompt]);

	const stopReply = () => {
		setStopped(true);
		stopRequest.current = client.agent.messages
			.stop({ threadId }, { context: { scope: props.scope } })
			.catch(() => undefined);
		void lane.cancel();
	};

	const reloadThread = async (): Promise<SavedThread | null> => {
		const options = orpc.agent.threads.get.queryOptions({
			input: { id: threadId },
			context: { scope: props.scope },
		});
		const latest = await queryClient
			.fetchQuery({ ...options, queryKey: [...options.queryKey, props.scope], staleTime: 0 })
			.catch(() => null);
		return latest && { messages: latest.messages as UIMessage[], active: Boolean(latest.thread.activeRunId) };
	};

	// Follows a reply the connection lost, only while no other request is open; it checks it is still current after
	// every await (recovery.ts).
	const followRun = (isCurrent: () => boolean) =>
		recoverRun({
			isCurrent,
			reload: reloadThread,
			apply: (saved) => {
				clearError();
				setMessages(saved);
			},
			resume: () => resumeStream(),
		}).finally(() => {
			if (isCurrent()) refreshThreads(queryClient);
		});
	const recover = useEffectEvent(() => void lane.runIfIdle(followRun));

	// Continue only the reply generated with the current context choices; the server checks its stored metadata too.
	const fresh = document !== null && (!props.context.document || !props.context.posting);
	const continuationBlocked =
		fresh &&
		(messages.at(-1)?.metadata as { contextScope?: string } | undefined)?.contextScope !==
			JSON.stringify([props.context.document !== false, props.context.posting !== false]);

	// A reply the connection lost may still run on the server, which refuses a second one: Retry follows it as recovery
	// does. Only with no run left is the message sent again: a failed continuation (after an answer) as it was,
	// since regenerating would drop the answer.
	const retry = () => {
		if (readOnly || continuationBlocked) return;
		clearError();
		void lane.run(async (isCurrent) => {
			const latest = await reloadThread();
			if (!isCurrent()) return;
			if (latest?.active) return followRun(isCurrent);
			const continuation =
				lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
				lastAssistantMessageIsCompleteWithApprovalResponses({ messages });
			await (continuation ? sendMessage() : regenerate());
		});
	};

	// A reply still running when the conversation opened is followed until it finishes (resume needs Redis). Only the
	// state at opening counts: a later refresh of the thread never starts a second stream. Leaving aborts every request.
	const [openedRunning] = useState(props.activeRun);
	useEffect(() => {
		if (openedRunning) recover();
		return () => void lane.cancel();
	}, [openedRunning, lane]);

	// In the background the OS may cut the connection, so requests are detached here; the run goes on on the server.
	// Back in the foreground, once the detach settled, the thread is reloaded as saved and a run still going is followed.
	// Every background transition cancels (even when idle), so a recovery still queued from an earlier foreground is
	// dropped; the queued one also checks the app is still active when the detach has settled.
	const onAppState = useEffectEvent((state: string) => {
		if (state === "background") {
			const busy = lane.busy();
			const cancelled = lane.cancel();
			if (busy) detaching.current = cancelled;
			return;
		}
		if (state !== "active" || !detaching.current) return;
		const settled = detaching.current ?? Promise.resolve();
		detaching.current = null;
		void lane.runAfter(settled, () => AppState.currentState === "active", followRun);
	});
	useEffect(() => {
		const subscription = AppState.addEventListener("change", onAppState);
		return () => subscription.remove();
	}, []);

	// ---- Proposed edits ----

	const proposals = useMemo(
		() =>
			document
				? messages.flatMap((message) =>
						message.parts.flatMap((part) => (isProposeEdits(part) ? toProposals(part, statuses) : [])),
					)
				: [],
		[messages, statuses, document],
	);
	// Kept after the assistant closes: Page marks them while they're pending.
	const documentId = document?.id;
	useEffect(() => {
		if (documentId && document?.kind === "resume") publishProposals(documentId, proposals);
	}, [documentId, document?.kind, proposals]);

	const record = (message: UIMessage, part: ToolPart, changed: readonly Proposal[], next: EditStatus) => {
		if (!changed.length) return;
		setStatuses((current) => new Map([...current, ...changed.map((proposal) => [proposal.id, next] as const)]));
		const { toolCallId } = part;
		if (!toolCallId) return;
		statusRequest.current = statusRequest.current
			.then(() =>
				client.agent.messages.setEditStatus(
					{
						threadId,
						messageId: message.id,
						toolCallId,
						edits: changed.map((proposal) => ({ id: proposal.id, status: next })),
					},
					{ context: { scope: props.scope } },
				),
			)
			.then(() => refreshThreads(queryClient))
			.catch(() => showToast({ title: t`Couldn't sync the edit status. Try again online.`, variant: "warning" }));
	};
	// Kept current for the memoized handlers below, so the message rows keep their props while a reply streams.
	const recordRef = useRef(record);
	useLayoutEffect(() => {
		recordRef.current = record;
	});

	// Undoing an accepted edit (the toast's Undo, or undo in the editor) makes it pending again. Only an undo (the
	// document) or a status change can cause one, so streamed chunks don't re-check every edit.
	const recordUndone = useEffectEvent(() => {
		if (!document) return;
		for (const message of messages)
			for (const part of message.parts) {
				if (!isProposeEdits(part)) continue;
				const undone = toProposals(part, statuses).filter(
					(proposal) => proposal.status === "accepted" && document.stateOf(proposal) === "pending",
				);
				if (undone.length > 0) record(message, part, undone, "pending");
			}
	});
	// oxlint-disable-next-line react/set-state-in-effect -- an undo happens in the draft store; the new status is also saved to the thread
	useEffect(() => recordUndone(), [statuses, document]);

	const handlers = useMemo<ProposalHandlers | null>(
		() =>
			document
				? {
						statuses,
						stateOf: document.stateOf,
						locked: document.locked,
						onAccept: (message, part, chosen) => {
							const result = document.accept(chosen);
							if (!result) return;
							const { applied, undo, canUndo } = result;
							setUndo({
								id: applied.at(-1)?.id,
								canUndo,
								run: () => {
									undo();
									setUndo(null);
								},
							});
							recordRef.current(message, part, applied, "accepted");
						},
						undo,
						onReject: (message, part, chosen) => recordRef.current(message, part, chosen, "rejected"),
					}
				: null,
		[document, statuses, undo],
	);
	const answer = useMemo(
		() =>
			continuationBlocked
				? null
				: (toolCallId: string, output: string) =>
						// The answer's automatic continuation is a request too: it waits for anything open to end.
						void lane.run(async () => {
							await addToolOutput({ tool: "ask_user_question", toolCallId, output } as never);
						}),
		[continuationBlocked, lane, addToolOutput],
	);
	return {
		messages,
		status,
		error,
		stopped,
		streaming,
		readOnly,
		continuationBlocked,
		handlers,
		answer,
		send,
		stopReply,
		retry,
		decide: (decision: { id: string; approved: boolean }) =>
			void lane.run(async () => {
				await addToolApprovalResponse(decision);
			}),
	};
}
