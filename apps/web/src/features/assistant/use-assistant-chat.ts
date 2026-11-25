import type { MessageContext } from "./chat";
import type { AgentMessagesApi } from "@rezumi/ai/chat-transport";
import type { AgentUIMessage } from "@rezumi/ai/tools/agent-tool-contracts";
import type { ChatTransport, UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useLayoutEffect, useMemo, useRef } from "react";
import { resumeAgentStream, sendAgentMessage } from "@rezumi/ai/chat-transport";
import { agentMessageMetadataSchema } from "@rezumi/ai/tools/agent-tool-contracts";
import { generateId } from "@rezumi/utils/string";
import { DocumentNotReadyError } from "./send-guard";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { client, streamClient } from "@/libs/orpc/client";

// Apart from chat.ts so pages that only list conversations don't load the AI SDK.

// Stop requests still on their way to the server, by conversation. The next message waits for its stop, so the server
// already knows the run was stopped and frees the conversation instead of answering "still replying".
const pendingStops = new Map<string, Promise<unknown>>();

/** Tells the server to stop the conversation's reply; the next message in it is sent once the server has heard. */
export function requestStop(threadId: string) {
	const request = client.agent.messages
		.stop({ threadId })
		.catch(() => undefined)
		.finally(() => {
			if (pendingStops.get(threadId) === request) pendingStops.delete(threadId);
		});
	pendingStops.set(threadId, request);
}

const messagesApi: AgentMessagesApi = {
	send: (input, options) =>
		streamClient.agent.messages.send({ ...input, message: input.message as AgentUIMessage }, options),
	resume: (input, options) => streamClient.agent.messages.resume(input, options),
};

type UseAssistantChatInput = {
	threadId: string;
	initialMessages: UIMessage[];
	/** A reply was streaming when the conversation opened: pick it up again (needs Redis on the server). */
	resume: boolean;
	/** Read when a message is sent, so the chips always apply to the next message. */
	context: MessageContext;
	/** Which AI the conversation runs on, while the account chooses; each reply on Rezumi AI costs one Coach turn. */
	aiSource?: "rezumi" | "own" | undefined;
	/**
	 * Runs before every request, answers and retries included: null to send, else why not. A refusal fails the request
	 * with a `DocumentNotReadyError` carrying the reason.
	 */
	beforeSend?: (() => Promise<string | null>) | undefined;
	onFinish: () => void;
};

/**
 * The conversation's chat: messages stream in over oRPC, answers to the assistant's questions continue the reply,
 * and only the newest message is sent (the server keeps the transcript).
 */
export function useAssistantChat({
	threadId,
	initialMessages,
	resume,
	context,
	aiSource,
	beforeSend,
	onFinish,
}: UseAssistantChatInput) {
	const contextRef = useRef(context);
	const aiSourceRef = useRef(aiSource);
	const beforeSendRef = useRef(beforeSend);
	useLayoutEffect(() => {
		contextRef.current = context;
		aiSourceRef.current = aiSource;
		beforeSendRef.current = beforeSend;
	});

	const transport = useMemo<ChatTransport<AgentUIMessage>>(
		() => ({
			async sendMessages(options) {
				await pendingStops.get(threadId);
				const problem = (await beforeSendRef.current?.()) ?? null;
				if (problem) throw new DocumentNotReadyError(problem);
				options.abortSignal?.throwIfAborted();
				const source = aiSourceRef.current ? { aiSource: aiSourceRef.current, idempotencyKey: generateId() } : {};
				return sendAgentMessage(messagesApi, threadId, contextRef.current, options, source);
			},
			reconnectToStream: ({ abortSignal }) =>
				resumeAgentStream(messagesApi, threadId, { signal: abortSignal, idleMs: null }),
		}),
		[threadId],
	);

	return useChat<AgentUIMessage>({
		id: threadId,
		messages: initialMessages as AgentUIMessage[],
		resume,
		transport,
		throttle: 50,
		messageMetadataSchema: agentMessageMetadataSchema,
		sendAutomaticallyWhen: (input) =>
			lastAssistantMessageIsCompleteWithToolCalls(input) || lastAssistantMessageIsCompleteWithApprovalResponses(input),
		onFinish,
		onError: (error) => {
			openCreditsDialogForError(error);
		},
	});
}
