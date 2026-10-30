import type { ChatAttachment, MessageContext } from "@/features/assistant/chat";
import type { RouterOutput } from "@/libs/orpc/client";
import type { QueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import { Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import z from "zod";
import { toast } from "@rezumi/ui/components/toast";
import { formatFileSize } from "@rezumi/utils/file";
import { cn } from "@rezumi/utils/style";
import { useSessionDraft } from "./hooks";
import { useCareerTime, useNow, withUndo } from "./shared";
import { acceptUploads, MAX_ATTACHMENTS_PER_MESSAGE } from "@/features/assistant/attachment-limits";
import { fileToBase64 } from "@/features/assistant/chat";
import { PendingTurn } from "@/features/assistant/pending-turn";
import { PromptBox } from "@/features/assistant/prompt-box";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

// The open conversation (AI SDK, Markdown) loads once the coach is on screen, so pages that only use the helpers
// here (the workspace) don't carry it.
const loadChatView = () => import("./coach-chat");
const ChatView = lazy(() => loadChatView().then((module) => ({ default: module.ChatView })));

// ---- What a message shared: recorded on the user message when it's sent, shown as "Used" chips under the answer. ----

export const usedSchema = z.object({
	context: z.object({
		facts: z.array(z.string()).catch([]),
		stories: z.array(z.string()).catch([]),
		preferences: z.boolean().catch(false),
		applications: z.boolean().catch(false),
		offers: z.array(z.string()).catch([]),
		web: z.boolean().catch(false),
	}),
});
export type Used = z.infer<typeof usedSchema>;

/** "Demo AI connection": the provider label, naming it a connection once. */
export const connectionName = (label: string) => (/connection$/i.test(label) ? label : t`${label} connection`);

/** Shared and switched-on facts and stories the coach sees in this scope (global coach: shared only). */
export function useCoachKnowledge(applicationId: string | null) {
	const facts = useQuery(orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } }));
	const stories = useQuery(orpc.career.stories.queryOptions({ input: { applicationId } }));
	// The query results are new objects each render; their refetch functions are not, so `retry` (and this whole
	// object) stays the same while a reply streams.
	const { refetch: refetchFacts } = facts;
	const { refetch: refetchStories } = stories;
	const all = facts.data ?? [];
	// Same order and filters as the server's career context, so the recorded ids are what was sent.
	const active = all.filter(
		(fact) => fact.status === "active" && (fact.applicationId === null || fact.applicationId === applicationId),
	);
	const usable = (stories.data ?? []).filter(
		(story) =>
			story.data.factIds.length > 0 &&
			story.data.factIds.every((id) =>
				active.some(
					(fact) =>
						fact.id === id && (fact.revisions.length === 0 || new Date(fact.updatedAt) <= new Date(story.updatedAt)),
				),
			),
	);
	return {
		loaded: facts.isSuccess && stories.isSuccess,
		isPending: facts.isPending || stories.isPending,
		isError: facts.isError || stories.isError,
		retry: () => {
			void refetchFacts();
			void refetchStories();
		},
		all,
		active,
		stories: usable,
		allStories: stories.data ?? [],
	};
}
export type Knowledge = ReturnType<typeof useCoachKnowledge>;

export const usedFor = (knowledge: Knowledge, context: MessageContext): Used => ({
	context: {
		facts: context.memory ? knowledge.active.slice(0, 30).map((fact) => fact.id) : [],
		stories: context.memory ? knowledge.stories.slice(0, 8).map((story) => story.id) : [],
		preferences: context.memory === true,
		applications: context.application === true,
		offers: context.offerIds ?? [],
		web: context.web === true,
	},
});

// ---- Conversations, listed on Career → Coach and in the workspace sheet ----

type ThreadSummary = RouterOutput["agent"]["threads"]["list"][number];

/** New conversations are titled in English on the server until their first message. */
export const titleFor = (thread: ThreadSummary | undefined) =>
	thread && thread.title !== "New conversation" ? thread.title : t`New conversation`;

/** "Now", "17:58", "Yesterday", "Mon 5 Oct", then "28 Sep". */
export function useConversationDate() {
	const { format, time, day } = useCareerTime();
	const now = useNow();
	const dayKey = (value: Date) => format(value, { year: "numeric", month: "numeric", day: "numeric" });
	return (value: Date) => {
		const age = now.getTime() - value.getTime();
		if (age < 60_000) return t`Now`;
		if (dayKey(value) === dayKey(now)) return time(value);
		if (dayKey(value) === dayKey(new Date(now.getTime() - 86_400_000))) return t`Yesterday`;
		if (age < 6 * 86_400_000) return day(value);
		return format(value, {
			day: "numeric",
			month: "short",
			...(value.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
		});
	};
}

/**
 * Deletes a conversation when its Undo toast closes. `hide` runs at once; `restore` brings it back on Undo, or when
 * the delete fails.
 */
export function deleteConversation(queryClient: QueryClient, id: string, hide: () => void, restore: () => void) {
	hide();
	withUndo({
		description: t`Conversation deleted`,
		commit: async () => {
			try {
				await client.agent.threads.delete({ id });
			} catch (error) {
				restore();
				toastError(error, t`Couldn't delete this conversation. Try again.`);
			} finally {
				void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
			}
		},
		onUndo: restore,
	});
}

// ---- The thread ----

export type Prompt = { text: string; attachments: ChatAttachment[]; used: Used };

type CoachThreadProps = {
	/** No thread yet: the empty state; the first message (or attachment) creates one. */
	threadId: string | null;
	createThread: () => Promise<string>;
	/** The first message created this thread; it's sent as soon as the thread opens. */
	onThreadCreated: (id: string, text: string) => void;
	/** The application this conversation is about (the workspace sheet), or null for the whole search. */
	applicationId: string | null;
	/** Workspace sheet: facts are remembered for this company only. */
	company?: string;
	context: MessageContext;
	/** "Demo AI connection". */
	connection: string;
	onChangeConnection: () => void;
	header: (messages: readonly UIMessage[]) => ReactNode;
	/** After the last message, once the reply is complete (the coach page's copy button). */
	afterMessages?: (messages: readonly UIMessage[]) => ReactNode;
	empty: (send: (text: string) => void) => ReactNode;
	chips?: ReactNode;
	/** The connection picker, in the composer's toolbar. */
	model?: ReactNode;
	privacy?: ReactNode;
	placeholder: string;
	/** Keeps the unsent draft when the thread closes (the sheet). */
	draftKey?: string;
	disabled?: boolean;
	variant: "page" | "sheet";
};

/** The coach's chat, shared by Career → Coach and the workspace sheet: messages, writing state, composer. */
export function CoachThread(props: CoachThreadProps) {
	const knowledge = useCoachKnowledge(props.applicationId);
	useEffect(() => void loadChatView(), []);
	const [prompt, setPrompt] = useState<Prompt | null>(null);
	// The message being started, shown at once while the conversation is created.
	const [startingText, setStartingText] = useState<string | null>(null);
	const starting = startingText !== null;
	const draft = useRef<string | null>(null);
	const creating = useRef<Promise<string> | null>(null);

	// A conversation exists from its first message or attachment; one created for an attachment is reused.
	const ensureThread = () => {
		if (props.threadId) return Promise.resolve(props.threadId);
		if (draft.current) return Promise.resolve(draft.current);
		creating.current ??= props
			.createThread()
			.then((id) => {
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
		if (starting || props.disabled) return false;
		setStartingText(text);
		try {
			const id = await ensureThread();
			setPrompt({ text, attachments, used: usedFor(knowledge, props.context) });
			draft.current = null;
			props.onThreadCreated(id, text);
			return true;
		} catch (error) {
			toastError(error, t`Couldn't start the conversation. Try again.`);
			return false;
		} finally {
			setStartingText(null);
		}
	};

	if (!props.threadId)
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				{props.header([])}
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className={contentClass[props.variant]}>
						{startingText ? (
							<PendingTurn text={startingText} />
						) : (
							<Empty render={props.empty} send={(text) => void start(text)} />
						)}
					</div>
				</div>
				<Composer
					{...props}
					streaming={starting}
					disabled={props.disabled ?? false}
					ensureThread={ensureThread}
					onSend={start}
					onStop={() => undefined}
				/>
			</div>
		);

	return (
		<ThreadSession
			key={props.threadId}
			{...props}
			threadId={props.threadId}
			knowledge={knowledge}
			prompt={prompt}
			onPromptSent={() => setPrompt(null)}
		/>
	);
}

type EmptyProps = { render: CoachThreadProps["empty"]; send: (text: string) => void };

function Empty({ render, send }: EmptyProps) {
	return render(send);
}

export const contentClass = {
	page: "mx-auto grid w-full max-w-[720px] content-start gap-6 px-1 pt-6 pb-3",
	sheet: "grid content-start gap-4 p-[18px]",
};

export type SessionProps = Omit<CoachThreadProps, "threadId"> & {
	threadId: string;
	knowledge: Knowledge;
	prompt: Prompt | null;
	onPromptSent: () => void;
};

/** Reads the conversation once when it opens (the chat takes its messages once); a new one skips the read. */
function ThreadSession(props: SessionProps) {
	const [fresh] = useState(() => props.prompt !== null);
	const thread = useQuery({
		...orpc.agent.threads.get.queryOptions({ input: { id: props.threadId } }),
		enabled: !fresh,
		refetchOnMount: "always",
		refetchOnWindowFocus: false,
	});

	const pending = props.prompt && !thread.error ? props.prompt.text : null;
	const loading = (
		<div className="flex min-h-0 flex-1 flex-col">
			{props.header([])}
			{pending ? (
				// A first message is already on its way: show it instead of an empty wait.
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className={contentClass[props.variant]}>
						<PendingTurn text={pending} />
					</div>
				</div>
			) : (
				<div className="grid flex-1 place-items-center p-6 text-sm text-muted">
					{thread.error ? (
						<p role="alert">
							<Trans>This conversation couldn't be opened. Refresh the page to try again.</Trans>
						</p>
					) : (
						// Hidden for the first 150ms, so a quick read never flashes a spinner.
						<Spinner
							size="md"
							color="current"
							className="transition-opacity delay-150 duration-standard ease-enter starting:opacity-0"
						/>
					)}
				</div>
			)}
		</div>
	);

	if (fresh)
		return (
			<Suspense fallback={loading}>
				<ChatView {...props} initialMessages={[]} activeRun={false} readOnly={false} />
			</Suspense>
		);
	if (thread.data && thread.isFetchedAfterMount)
		return (
			<Suspense fallback={loading}>
				<ChatView
					{...props}
					initialMessages={thread.data.messages}
					activeRun={Boolean(thread.data.thread.activeRunId)}
					readOnly={thread.data.isReadOnly}
				/>
			</Suspense>
		);
	return loading;
}

// ---- Composer ----

type Upload = ChatAttachment & { size: number };

type ComposerProps = Pick<CoachThreadProps, "placeholder" | "chips" | "model" | "privacy" | "draftKey" | "variant"> & {
	streaming: boolean;
	disabled: boolean;
	ensureThread: () => Promise<string>;
	/** True once the message is on its way; false keeps it in the box. */
	onSend: (text: string, attachments: ChatAttachment[]) => boolean | Promise<boolean>;
	onStop: () => void;
};

/** The message box with the context chips, attach and send (stop while writing). */
export function Composer(props: ComposerProps) {
	const { i18n } = useLingui();
	const draft = useSessionDraft(props.draftKey ? `coach:${props.draftKey}` : null, "", (value) =>
		typeof value === "string" ? value : undefined,
	);
	const text = draft.value;
	const setText = draft.setValue;
	const [attachments, setAttachments] = useState<Upload[]>([]);
	const [uploading, setUploading] = useState(false);

	const submit = async () => {
		const value = text.trim();
		if (!value || props.streaming || props.disabled || uploading) return;
		const sent = await props.onSend(
			value,
			attachments.map(({ size: _size, ...attachment }) => attachment),
		);
		if (!sent) return;
		setText("");
		draft.clear();
		setAttachments([]);
	};

	const upload = async (chosen: File[]) => {
		const files = acceptUploads(chosen, attachments.length);
		if (files.length === 0) return;
		setUploading(true);
		try {
			const threadId = await props.ensureThread();
			const uploaded = await Promise.all(
				files.map(async (file) => {
					const attachment = await client.agent.attachments.create({
						threadId,
						filename: file.name,
						mediaType: file.type || "application/octet-stream",
						data: await fileToBase64(file),
					});
					return { id: attachment.id, filename: attachment.filename, mediaType: attachment.mediaType, size: file.size };
				}),
			);
			setAttachments((current) => [...current, ...uploaded]);
		} catch (error) {
			toastError(error, t`Couldn't attach the file. Try again.`);
		} finally {
			setUploading(false);
		}
	};

	const page = props.variant === "page";

	return (
		<div className={page ? "" : "px-3.5 pt-2 pb-3.5"}>
			<div className={cn("grid gap-2", page && "mx-auto w-full max-w-[720px]")}>
				<PromptBox
					variant={page ? "primary" : "secondary"}
					value={text}
					onValueChange={setText}
					onSubmit={() => void submit()}
					onStop={props.onStop}
					streaming={props.streaming}
					disabled={props.disabled}
					canSend={text.trim().length > 0 && !uploading}
					placeholder={props.placeholder}
					label={t`Message the coach`}
					maxHeight={200}
					files={attachments.map((attachment) => ({
						key: attachment.id,
						name: attachment.filename,
						mimeType: attachment.mediaType,
						sizeLabel: formatFileSize(attachment.size, i18n.locale),
						removeLabel: t`Remove ${attachment.filename}`,
						onRemove: () => setAttachments((current) => current.filter((item) => item.id !== attachment.id)),
					}))}
					context={props.chips}
					toolbar={props.model}
					attach={{
						isDisabled: props.disabled || attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE,
						isPending: uploading,
						onFiles: (files) => void upload(files),
					}}
				/>
				{props.privacy}
			</div>
		</div>
	);
}

/** True when the text reached the clipboard. */
export async function copyToClipboard(text: string, done: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.add({ description: done });
		return true;
	} catch {
		toast.add({ type: "error", description: t`Couldn't copy to the clipboard. Try again.` });
		return false;
	}
}
