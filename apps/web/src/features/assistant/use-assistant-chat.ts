import type { MessageContext } from "./chat";
import type { AgentUIMessage } from "@rezumi/ai/tools/agent-tool-contracts";
import type { ChatTransport, UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import {
	lastAssistantMessageIsCompleteWithApprovalResponses,
	lastAssistantMessageIsCompleteWithToolCalls,
	parseJsonEventStream,
	uiMessageChunkSchema,
} from "ai";
import { useLayoutEffect, useMemo, useRef } from "react";
import { agentMessageMetadataSchema } from "@rezumi/ai/tools/agent-tool-contracts";
import { generateId } from "@rezumi/utils/string";
import { openCreditsDialogForError } from "@/features/billing/ai-source-menu";
import { streamClient } from "@/libs/orpc/client";

// Apart from chat.ts so pages that only list conversations don't load the AI SDK.

function parseSse(stream: ReadableStream<string>) {
	return parseJsonEventStream({
		stream: stream.pipeThrough(new TextEncoderStream()),
		schema: uiMessageChunkSchema,
	}).pipeThrough(
		new TransformStream({
			transform(chunk, controller) {
				if (!chunk.success) {
					console.warn("[assistant] dropping malformed SSE frame", chunk.error);
					return;
				}
				controller.enqueue(chunk.value);
			},
		}),
	);
}

const attachmentIdsOf = (body: object | undefined) =>
	body && "attachmentIds" in body && Array.isArray(body.attachmentIds)
		? body.attachmentIds.filter((id): id is string => typeof id === "string")
		: undefined;

type UseAssistantChatInput = {
	threadId: string;
	initialMessages: UIMessage[];
	/** A reply was streaming when the conversation opened: pick it up again (needs Redis on the server). */
	resume: boolean;
	/** Read when a message is sent, so the chips always apply to the next message. */
	context: MessageContext;
	/** Which AI the conversation runs on, while the account chooses; each reply on Rezumi AI costs one Coach turn. */
	aiSource?: "rezumi" | "own" | undefined;
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
	onFinish,
}: UseAssistantChatInput) {
	const contextRef = useRef(context);
	const aiSourceRef = useRef(aiSource);
	useLayoutEffect(() => {
		contextRef.current = context;
		aiSourceRef.current = aiSource;
	});

	const transport = useMemo<ChatTransport<AgentUIMessage>>(
		() => ({
			async sendMessages(options) {
				const message = options.messages.at(-1);
				if (!message) throw new Error("No message to send.");
				const attachmentIds = attachmentIdsOf(options.body);
				// Every reply is its own Rezumi AI action, with its own key.
				const source = aiSourceRef.current ? { aiSource: aiSourceRef.current, idempotencyKey: generateId() } : {};
				return parseSse(
					eventIteratorToUnproxiedDataStream(
						await streamClient.agent.messages.send(
							{
								threadId,
								message,
								context: contextRef.current,
								...(attachmentIds ? { attachmentIds } : {}),
								...source,
							},
							options.abortSignal ? { signal: options.abortSignal } : {},
						),
					),
				);
			},
			async reconnectToStream() {
				return parseSse(eventIteratorToUnproxiedDataStream(await streamClient.agent.messages.resume({ threadId })));
			},
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
