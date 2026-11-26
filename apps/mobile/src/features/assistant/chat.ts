import type { RouterOutput } from "@/api/client";
import type { MessageContext } from "@rezumi/ai/chat-transport";
import type { AgentMessagesApi } from "@rezumi/ai/chat-transport";
import type { AgentUIMessage } from "@rezumi/ai/tools/agent-tool-contracts";
import type { FileUIPart, UIMessage } from "ai";
import { Chat, useChat } from "@ai-sdk/react";
import { t } from "@lingui/core/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { resumeAgentStream, sendAgentMessage } from "@rezumi/ai/chat-transport";
import { agentWebSources } from "@rezumi/ai/tools/agent-tool-contracts";
import { AiConsentDeclined } from "@/api/ai-consent";
import { client, orpc, streamClient } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";

export type { MessageContext } from "@rezumi/ai/chat-transport";
export type ChatAttachment = { id: string; filename: string; mediaType: string };
export type ThreadSummary = RouterOutput["agent"]["threads"]["list"][number];

export const attachmentPart = (attachment: ChatAttachment): FileUIPart => ({
	type: "file",
	url: `agent-attachment:${attachment.id}`,
	mediaType: attachment.mediaType,
	filename: attachment.filename,
});

export const textOf = (message: UIMessage) =>
	message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("")
		.trim();

type TranscriptLabels = { user: string; assistant: string; sources: string };

/** The conversation as plain text, speaker by speaker, for Copy transcript. Tool steps are left out. */
export function transcriptOf(messages: readonly UIMessage[], labels: TranscriptLabels) {
	return messages
		.flatMap((message) => {
			const sources = agentWebSources(message)
				.map((source) => `${source.title}: ${source.url}`)
				.join("\n");
			const content = [textOf(message), ...(sources ? [`${labels.sources}:\n${sources}`] : [])]
				.filter(Boolean)
				.join("\n\n");
			return content ? [`${message.role === "user" ? labels.user : labels.assistant}: ${content}`] : [];
		})
		.join("\n\n");
}

/** Conversations for the signed-in server, newest first. */
export function useThreads() {
	const session = useSession();
	const scope = getAccountScope();
	const options = orpc.agent.threads.list.queryOptions({ input: {}, context: { scope: scope ?? "" } });
	return useQuery({
		...options,
		queryKey: [...options.queryKey, scope],
		enabled: session.status === "signed-in",
	});
}

export const refreshThreads = (queryClient: ReturnType<typeof useQueryClient>) =>
	void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.key() });

type UseAssistantChatInput = {
	threadId: string;
	initialMessages: UIMessage[];
	/** Read when a message is sent, so the chips always apply to the next message. */
	context: MessageContext;
	onFinish: () => void;
	scope: string;
	beforeSend?: ((context: MessageContext) => Promise<boolean>) | undefined;
};

/**
 * The conversation's chat: messages stream in over oRPC, answers to the assistant's questions continue the reply,
 * and only the newest message is sent (the server keeps the transcript).
 */
/** Running replies are picked up by the conversation controller, not on mount. */
export function useAssistantChat({
	threadId,
	initialMessages,
	context,
	onFinish,
	scope,
	beforeSend,
}: UseAssistantChatInput) {
	const contextRef = useRef(context);
	const onFinishRef = useRef(onFinish);
	const beforeSendRef = useRef(beforeSend);
	useLayoutEffect(() => {
		contextRef.current = context;
		onFinishRef.current = onFinish;
		beforeSendRef.current = beforeSend;
	});

	// One Chat per conversation (the caller keys it by thread), so callers can hold it outside render (chat-view.tsx).
	const instance = useMemo(() => {
		const agentMessages: AgentMessagesApi = {
			// The server validates the UI message; bind every request to this conversation's account.
			send: (input, options) =>
				streamClient.agent.messages.send(
					{ ...input, message: input.message as AgentUIMessage },
					{ ...options, context: { scope } },
				),
			resume: (input, options) => streamClient.agent.messages.resume(input, { ...options, context: { scope } }),
		};
		const chat: Chat<UIMessage> = new Chat<UIMessage>({
			id: threadId,
			messages: initialMessages,
			transport: {
				// The server's resumable stream replays the reply from its start, so the client starts the message over.
				resumeStreamIsReplay: true,
				sendMessages: async (options) => {
					const context = contextRef.current;
					if (beforeSendRef.current && !(await beforeSendRef.current(context)))
						throw new ORPCError("PRECONDITION_FAILED", { message: t`Save the document before sending.` });
					options.abortSignal?.throwIfAborted();
					return sendAgentMessage(agentMessages, threadId, context, options).catch((error: unknown) => {
						// An SDK abort silences the failure and drops Retry. Keep the unsent prompt visible.
						if (error instanceof AiConsentDeclined) {
							throw new ORPCError("PRECONDITION_FAILED", { message: error.message, cause: error });
						}
						throw error;
					});
				},
				// A resumed run keeps the parts of the message from before it, as the chat shows them now.
				reconnectToStream: ({ abortSignal }) =>
					resumeAgentStream(agentMessages, threadId, {
						signal: abortSignal,
						messageById: (id) => chat.messages.find((message) => message.id === id),
					}),
			},
			sendAutomaticallyWhen: (input) =>
				lastAssistantMessageIsCompleteWithToolCalls(input) ||
				lastAssistantMessageIsCompleteWithApprovalResponses(input),
			onFinish: () => onFinishRef.current(),
		});
		return chat;
		// The initial messages are read once, when the chat is created.
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- the chat takes its messages once; it's keyed by thread
	}, [threadId, scope]);

	return { ...useChat<UIMessage>({ chat: instance, throttle: 50 }), instance };
}

/**
 * A conversation whose connection was switched off or removed continues on `provider` (the default, which its privacy
 * line names), rather than failing on send.
 */
export function useConversationConnection(
	summary: { id: string; aiProviderId: string | null } | undefined,
	provider: { id: string } | undefined,
) {
	const queryClient = useQueryClient();
	const staleId = summary && provider && summary.aiProviderId !== provider.id ? summary.id : null;
	const providerId = provider?.id;
	const scope = getAccountScope();
	useEffect(() => {
		if (!staleId || !providerId || !scope) return;
		void client.agent.threads
			.update({ id: staleId, aiProviderId: providerId }, { context: { scope } })
			.then(() => refreshThreads(queryClient))
			.catch(() => undefined);
	}, [staleId, providerId, queryClient, scope]);
}
