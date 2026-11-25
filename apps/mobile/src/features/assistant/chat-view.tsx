import type { ChatAttachment, MessageContext } from "./chat";
import type { AssistantDocument } from "./document";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Composer } from "./composer";
import { Conversation, Empty } from "./conversation";
import { errorText } from "./errors";
import { orpc, SessionChangedError } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";
import { EmptyState, Spinner, showToast, usePullRefresh, useThemeColor } from "@/ui";
import { ChatFrame } from "@/ui/keyboard";

export type ChatViewProps = {
	/** The connection and its cost, displayed with the composer. */
	sourceNote?: string | undefined;
	onRefresh?: (() => Promise<unknown>) | undefined;
	/** The conversation, or null for a new one: the first message (or attachment) creates it through `createThread`. */
	threadId: string | null;
	createThread: (scope: string) => Promise<string>;
	/** The first message created this conversation; show it from now on (pass it back as `threadId`). */
	onThreadCreated: (id: string) => void;
	/** Read at send time: the chips apply to the next message. */
	context: MessageContext;
	/** The open document: its change sets apply to the draft and are marked on Page. Null for the coach. */
	document: AssistantDocument | null;
	/** Says what a send shares, under the composer. */
	privacy: string;
	placeholder: string;
	/** How a copied transcript names the other side: "Assistant" or "Coach". */
	assistantName: string;
	/** Context chips, before the attachments. */
	chips?: ReactNode;
	/** Shown while the conversation has no messages; `send` sends a starter. */
	empty?: (send: (text: string) => void) => ReactNode;
	/** Sent once, as soon as it can be (a question asked from another screen). */
	prompt?: string | null;
	onPromptSent?: () => void;
	/** Nothing can be sent (locked document, the Profile still loading). */
	disabled?: boolean;
	/** Error line: Switch model. */
	onSwitchModel?: () => void;
	/** After each reply, for example to refresh the Profile. */
	onFinish?: () => void;
};

type Prompt = { threadId: string; text: string; attachments: ChatAttachment[] };

/** One conversation (or a new one), its change sets and questions, and the composer. */
export function ChatView(props: ChatViewProps) {
	useSession();
	const scope = getAccountScope();
	return scope ? <ScopedChatView key={scope} {...props} scope={scope} /> : null;
}

export type ScopedChatViewProps = ChatViewProps & { scope: string };

function ScopedChatView(props: ScopedChatViewProps) {
	const pull = usePullRefresh(...(props.onRefresh ? [props.onRefresh] : []));
	const { t } = useLingui();
	const accent = useThemeColor("accent");
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	const [starting, setStarting] = useState(false);
	const startingRef = useRef(false);
	const draft = useRef<string | null>(null);
	const creating = useRef<Promise<string> | null>(null);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const checkCurrent = () => {
		if (!mounted.current || getAccountScope() !== props.scope) throw new SessionChangedError();
	};

	// A conversation exists from its first message or attachment; one created for an attachment is reused.
	const ensureThread = (): Promise<string> => {
		checkCurrent();
		if (props.threadId) return Promise.resolve(props.threadId);
		if (draft.current) return Promise.resolve(draft.current);
		creating.current ??= props
			.createThread(props.scope)
			.then((id) => {
				checkCurrent();
				draft.current = id;
				return id;
			})
			.finally(() => {
				creating.current = null;
			});
		return creating.current;
	};

	/** Resolves false when the conversation couldn't start, so the composer keeps the message. */
	const start = async (text: string, attachments: ChatAttachment[] = []) => {
		if (startingRef.current || props.disabled) return false;
		startingRef.current = true;
		setStarting(true);
		try {
			const id = await ensureThread();
			checkCurrent();
			setPrompt({ threadId: id, text, attachments });
			draft.current = null;
			props.onThreadCreated(id);
			return true;
		} catch (error) {
			showToast({ title: errorText(error, t`Couldn't start the conversation. Try again.`) });
			return false;
		} finally {
			startingRef.current = false;
			setStarting(false);
		}
	};

	const startPrompt = useEffectEvent((text: string) => {
		props.onPromptSent?.();
		void start(text);
	});
	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect -- a question handed over from another screen starts its conversation (async: it creates the thread first)
		if (props.prompt && !props.disabled) startPrompt(props.prompt);
	}, [props.prompt, props.disabled]);

	if (!props.threadId)
		return (
			<ChatFrame>
				<ScrollView
					alwaysBounceVertical
					refreshControl={
						props.onRefresh ? <RefreshControl {...pull} tintColor={accent} colors={[accent]} /> : undefined
					}
					className="flex-1"
					contentContainerClassName="gap-4 p-4"
				>
					<Empty render={props.empty} send={(text) => void start(text)} />
				</ScrollView>
				<Composer
					{...props}
					streaming={false}
					disabled={starting || props.disabled === true}
					ensureThread={ensureThread}
					onSend={start}
					onStop={() => undefined}
				/>
			</ChatFrame>
		);

	return (
		<Session
			key={props.threadId}
			{...props}
			threadId={props.threadId}
			prompt={prompt?.threadId === props.threadId ? prompt : null}
			onPromptDelivered={() => setPrompt(null)}
		/>
	);
}

export type SessionProps = Omit<ScopedChatViewProps, "threadId" | "prompt"> & {
	threadId: string;
	prompt: Prompt | null;
	onPromptDelivered: () => void;
};

/** Reads the conversation fresh when it opens (the chat takes its messages once); a brand-new one skips the read. */
function Session(props: SessionProps) {
	const { t } = useLingui();
	const session = useSession();
	const [fresh] = useState(() => props.prompt !== null);
	const options = orpc.agent.threads.get.queryOptions({
		input: { id: props.threadId },
		context: { scope: props.scope },
	});
	const thread = useQuery({
		...options,
		queryKey: [...options.queryKey, props.scope],
		enabled: !fresh && session.status === "signed-in",
		refetchOnMount: "always",
	});

	if (fresh) return <Conversation {...props} initialMessages={[]} activeRun={false} readOnly={false} />;
	if (thread.data && (thread.isFetchedAfterMount || thread.fetchStatus === "paused"))
		return (
			<Conversation
				{...props}
				initialMessages={thread.data.messages as UIMessage[]}
				activeRun={Boolean(thread.data.thread.activeRunId)}
				readOnly={thread.data.isReadOnly}
			/>
		);
	return (
		<View className="flex-1 items-center justify-center p-6">
			{thread.error ? (
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`This conversation couldn't be opened.`}
					action={{ label: t`Retry`, onPress: () => void thread.refetch() }}
				/>
			) : (
				<Spinner />
			)}
		</View>
	);
}
