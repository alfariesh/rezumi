import type { ChatAttachment, MessageContext } from "./chat";
import type { AssistantDocument } from "./document";
import type { RouterOutput } from "@/libs/orpc/client";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { ChatListView, PromptSuggestion } from "@heroui-pro/react";
import { Button, Description, Dropdown, Label, Separator, Spinner, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { useConversationConnection } from "./chat";
import { Composer, Conversation } from "./conversation";
import { PendingTurn } from "./pending-turn";
import { ProviderSetup } from "./provider-setup";
import { useEditorStore } from "@/features/resume/editor/store";
import { formatVersionTime } from "@/features/resume/share/format";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { useConfirm } from "@/hooks/use-confirm";
import { toastError } from "@/libs/error-message";
import { ENTER_CLASS, stagger } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH2, renderAsH3 } from "@/libs/typography";

type UsableProvider = ReturnType<typeof useHasUsableAiProvider>["usableProviders"][number];
type ThreadSummary = RouterOutput["agent"]["threads"]["list"][number];

type AssistantPanelProps = {
	document: AssistantDocument;
	onClose: () => void;
};

const belongsTo = (thread: ThreadSummary, document: AssistantDocument) =>
	document.kind === "letter"
		? thread.coverLetterId === document.id
		: thread.workingResumeId === document.id && !thread.coverLetterId;

/**
 * The assistant beside the page: it knows the open document and the posting it's for, proposes edits that appear on
 * the page and as cards, and asks before writing anything the document doesn't say.
 */
export function AssistantPanel({ document, onClose }: AssistantPanelProps) {
	const queryClient = useQueryClient();
	const providers = useHasUsableAiProvider();
	const threads = useQuery(orpc.agent.threads.list.queryOptions());
	const selected = useEditorStore((state) => state.assistantThread);
	const prompt = useEditorStore((state) => state.assistantPrompt);
	const draft = useEditorStore((state) => state.assistantDraft);
	const [view, setView] = useState<"thread" | "history">("thread");
	const [providerId, setProviderId] = useState<string | null>(null);
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	// The message being started, shown at once while the conversation is created.
	const [startingText, setStartingText] = useState<string | null>(null);
	const starting = startingText !== null;
	const [context, setContext] = useState<MessageContext>({ document: true, posting: true });
	const [promptAttachments, setPromptAttachments] = useState<ChatAttachment[]>([]);
	const [draftKey, setDraftKey] = useState(0);
	const draftThread = useRef<string | null>(null);
	const creatingThread = useRef<Promise<string> | null>(null);

	const mine = (threads.data ?? []).filter((thread) => belongsTo(thread, document));
	// Opens the document's latest conversation unless a new one (or another) was asked for.
	const threadId = selected === "new" ? null : (selected ?? mine[0]?.id ?? null);
	const summary = threads.data?.find((item) => item.id === threadId);

	const usable = providers.usableProviders;
	// A conversation runs on its own connection; one switched off or removed moves to the default.
	const provider = usable.find((item) => item.id === (threadId ? summary?.aiProviderId : providerId)) ?? usable[0];
	useConversationConnection(threadId ? summary : undefined, provider);
	const providerLabel = provider?.label ?? summary?.providerLabel ?? t`your provider`;

	const ensureThread = async (): Promise<string> => {
		if (draftThread.current) return draftThread.current;
		if (creatingThread.current) return creatingThread.current;
		// A list refetch must not auto-open this empty draft while its composer still holds unsent files.
		useEditorStore.setState({ assistantThread: "new" });
		const input = {
			...(document.kind === "letter" ? { coverLetterId: document.id } : { resumeId: document.id }),
			...(provider ? { aiProviderId: provider.id } : {}),
		};
		const creating = client.agent.threads.start(input).then((created) => {
			if (creatingThread.current === creating) draftThread.current = created.id;
			return created.id;
		});
		creatingThread.current = creating;
		try {
			return await creating;
		} finally {
			if (creatingThread.current === creating) creatingThread.current = null;
		}
	};

	const start = async (text: string, attachments: ChatAttachment[] = []) => {
		if (starting) return;
		setStartingText(text);
		try {
			const id = await ensureThread();
			useEditorStore.setState({ assistantPrompt: text, assistantDraft: null });
			setPromptAttachments(attachments);
			useEditorStore.setState({ assistantThread: id });
			draftThread.current = null;
			useEditorStore.setState({ assistantSuggestions: null });
			setView("thread");
			void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
		} catch (error) {
			toastError(error, t`Couldn't start the conversation. Try again.`);
		}
		setStartingText(null);
	};

	// A question from ⌘K or Job match starts a conversation as soon as the assistant can. A link's draft never does.
	const autoStarted = useRef<string | null>(null);
	useEffect(() => {
		if (!prompt || selected !== "new" || !providers.hasUsableProvider || autoStarted.current === prompt) return;
		autoStarted.current = prompt;
		void start(prompt);
	});

	const chooseProvider = async (id: string) => {
		if (!threadId) setProviderId(id);
		const targetThreadId = threadId ?? draftThread.current;
		if (!targetThreadId) return;
		try {
			await client.agent.threads.update({ id: targetThreadId, aiProviderId: id });
			await queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
		} catch (error) {
			toastError(error, t`Couldn't switch models. Try again.`);
		}
	};

	const notSetUp = threads.error instanceof ORPCError && threads.error.code === "PRECONDITION_FAILED";

	return (
		<section aria-label={t`Assistant`} className="flex h-full min-h-0 flex-col">
			<header className="flex h-[52px] shrink-0 items-center gap-1 rounded-2xl bg-surface-secondary ps-4 pe-2">
				<Icon name="sparkle" size={20} className="text-accent" />
				<Typography type="h6" render={renderAsH2} className="me-auto">
					<Trans>Assistant</Trans>
				</Typography>

				{usable.length > 0 && (
					<ModelMenu
						open={modelMenuOpen}
						onOpenChange={setModelMenuOpen}
						providers={usable}
						current={provider}
						label={providerLabel}
						onChoose={(id) => void chooseProvider(id)}
					/>
				)}

				<IconButton
					icon="note-pencil"
					label={t`New conversation`}
					className="text-muted"
					onPress={() => {
						draftThread.current = null;
						creatingThread.current = null;
						setDraftKey((key) => key + 1);
						setContext({ document: true, posting: true });
						setPromptAttachments([]);
						useEditorStore.setState({ assistantDraft: null, assistantThread: "new" });
						setView("thread");
					}}
				/>
				<IconButton
					icon="clock-counter-clockwise"
					label={t`Past conversations`}
					aria-pressed={view === "history"}
					className={cn("text-muted", view === "history" && "bg-accent-soft text-accent-soft-foreground")}
					onPress={() => setView(view === "history" ? "thread" : "history")}
				/>
				<IconButton icon="x" label={t`Close the assistant`} shortcut="⌘J" className="text-muted" onPress={onClose} />
			</header>

			{notSetUp ? (
				<Notice>
					<Trans>
						The assistant isn't set up on this server. Whoever runs it needs to set ENCRYPTION_SECRET. Everything else
						works without it.
					</Trans>
				</Notice>
			) : providers.error ? (
				<AiProviderLoadState
					state={{
						...providers,
						retry: () => {
							providers.retry();
							void threads.refetch();
						},
					}}
				/>
			) : providers.isLoading || threads.isPending ? (
				<div className="grid flex-1 place-items-center">
					<Spinner size="md" color="current" className="text-muted" aria-hidden />
				</div>
			) : !providers.hasUsableProvider ? (
				<div className="min-h-0 flex-1 overflow-y-auto">
					<ProviderSetup />
				</div>
			) : view === "history" ? (
				<PastConversations
					threads={threads.data ?? []}
					document={document}
					currentId={threadId}
					onOpen={(id) => {
						useEditorStore.setState({ assistantThread: id });
						setView("thread");
					}}
				/>
			) : threadId ? (
				<ConversationLoader
					key={threadId}
					threadId={threadId}
					document={document}
					providerLabel={providerLabel}
					prompt={selected === threadId ? prompt : null}
					promptAttachments={promptAttachments}
					initialContext={{ ...context, ...(document.posting ? { applicationId: document.posting.id } : {}) }}
					onPromptSent={() => {
						useEditorStore.setState({ assistantPrompt: null });
						setPromptAttachments([]);
					}}
					onSwitchModel={() => setModelMenuOpen(true)}
				/>
			) : (
				<>
					{startingText ? (
						<PendingTurn text={startingText} className="min-h-0 flex-1 overflow-y-auto py-3" />
					) : (
						<EmptyState
							document={document}
							disabled={document.locked || starting}
							onPick={(text) => void start(text)}
						/>
					)}
					<Composer
						// A draft arriving while the box is open replaces what's in it.
						key={`${draftKey}:${draft ?? ""}`}
						initialText={draft ?? undefined}
						document={document}
						context={context}
						onContextChange={setContext}
						streaming={starting}
						disabled={document.locked}
						threadId={null}
						ensureThread={ensureThread}
						onSend={(text, attachments) => void start(text, attachments)}
						onStop={() => undefined}
					/>
				</>
			)}
		</section>
	);
}

type ConversationLoaderProps = {
	threadId: string;
	document: AssistantDocument;
	providerLabel: string;
	prompt: string | null;
	promptAttachments: ChatAttachment[];
	initialContext: MessageContext;
	onPromptSent: () => void;
	onSwitchModel: () => void;
};

/** Reads the conversation fresh each time it opens: the chat takes its messages once, when it mounts. */
function ConversationLoader({ threadId, document, ...props }: ConversationLoaderProps) {
	const thread = useQuery({
		...orpc.agent.threads.get.queryOptions({ input: { id: threadId } }),
		refetchOnMount: "always",
		refetchOnWindowFocus: false,
	});

	if (thread.error)
		return (
			<Notice>
				<Trans>This conversation couldn't be opened. Refresh the page to try again.</Trans>
			</Notice>
		);
	if (!thread.data || !thread.isFetchedAfterMount)
		// A first message is already on its way: show it instead of an empty wait.
		return props.prompt ? (
			<PendingTurn text={props.prompt} className="min-h-0 flex-1 overflow-y-auto py-3" />
		) : (
			// Hidden for the first 150ms, so a quick refetch never flashes a spinner.
			<div className="grid flex-1 place-items-center transition-opacity delay-150 duration-standard ease-enter starting:opacity-0">
				<Spinner size="md" color="current" className="text-muted" aria-hidden />
			</div>
		);

	return (
		<Conversation
			threadId={threadId}
			initialMessages={thread.data.messages}
			activeRun={Boolean(thread.data.thread.activeRunId)}
			document={document}
			readOnly={thread.data.isReadOnly || document.locked}
			{...props}
		/>
	);
}

type ModelMenuProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providers: readonly UsableProvider[];
	current: UsableProvider | undefined;
	label: string;
	onChoose: (id: string) => void;
};

function ModelMenu({ open, onOpenChange, providers, current, label, onChoose }: ModelMenuProps) {
	const navigate = useNavigate();

	return (
		<Dropdown isOpen={open} onOpenChange={onOpenChange}>
			<Button
				variant="ghost"
				size="sm"
				aria-label={t`Model: ${label}`}
				className="h-7 max-w-[140px] gap-0.5 px-2 text-xs text-muted"
			>
				<span className="truncate">{current?.model ?? label}</span>
				<Icon name="caret-down" size={16} />
			</Button>
			<Dropdown.Popover placement="bottom end" className="w-64">
				<Dropdown.Menu>
					<Dropdown.Section
						selectionMode="single"
						disallowEmptySelection
						selectedKeys={new Set(current ? [current.id] : [])}
						onSelectionChange={(keys) => {
							const [id] = keys === "all" ? [] : keys;
							if (typeof id === "string") onChoose(id);
						}}
					>
						{providers.map((item) => (
							<Dropdown.Item key={item.id} id={item.id} textValue={`${item.label} ${item.model}`}>
								<span className="grid min-w-0 flex-1">
									<Label className="truncate">{item.label}</Label>
									<Description className="truncate">{item.model}</Description>
								</span>
								<Dropdown.ItemIndicator />
							</Dropdown.Item>
						))}
					</Dropdown.Section>
					<Separator />
					<Dropdown.Item
						id="connect"
						textValue={t`Connect another…`}
						onAction={() => void navigate({ to: "/dashboard/settings/app", hash: "ai-providers" })}
					>
						<Label>
							<Trans>Connect another…</Trans>
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="m-4 rounded-xl bg-default p-4 text-sm text-muted">{children}</p>;
}

type Suggestion = { icon: IconName; label: string; hint: string };

function suggestionsFor(document: AssistantDocument, prepare: boolean): Suggestion[] {
	const tailor: Suggestion[] = document.posting
		? [
				{
					icon: "briefcase",
					label: t`Tailor to the ${document.posting.company} posting`,
					hint: t`Uses the linked application`,
				},
			]
		: [];

	// Prepare for next step: the application's fit, a follow-up and the interview (what the copilot did).
	if (prepare && document.posting)
		return [
			{ icon: "briefcase", label: t`How well do I fit this role?`, hint: t`Compares your resume with the posting` },
			{ icon: "envelope-simple", label: t`Draft a follow-up email`, hint: t`Short and polite, for the recruiter` },
			{
				icon: "chat-text",
				label: t`Prepare me for the interview`,
				hint: t`Likely questions, from the posting and your resume`,
			},
			...tailor,
		];

	if (document.kind === "letter")
		return [
			...tailor,
			{ icon: "lightning", label: t`Make the opening stronger`, hint: t`Leads with why you fit` },
			{ icon: "arrows-in-line-vertical", label: t`Make it shorter`, hint: t`Keeps the most specific parts` },
			{ icon: "text-align-left", label: t`Make it more specific`, hint: t`Uses facts from your resume` },
		];

	return [
		...tailor,
		{ icon: "scissors", label: t`Find weak bullets`, hint: t`Checks every bullet for action and result` },
		{
			icon: "arrows-in-line-vertical",
			label: t`Tighten to one page`,
			hint: t`Suggests cuts, never deletes on its own`,
		},
		{ icon: "text-align-left", label: t`Draft a summary`, hint: t`From your experience entries` },
	];
}

type EmptyStateProps = { document: AssistantDocument; disabled: boolean; onPick: (text: string) => void };

function EmptyState({ document, disabled, onPick }: EmptyStateProps) {
	const kind = document.kind === "letter" ? t`letter` : t`resume`;
	const prepare = useEditorStore((state) => state.assistantSuggestions === "prepare");

	return (
		<div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4">
			<div className="grid gap-1.5">
				<Typography type="h4" render={renderAsH3}>
					<Trans>What should we work on?</Trans>
				</Typography>
				<p className="text-sm text-muted">
					{document.posting ? (
						<Trans>
							I can see this {kind} and the {document.posting.company} posting. Suggestions come back as edits you can
							accept one by one.
						</Trans>
					) : (
						<Trans>I can see this {kind}. Suggestions come back as edits you can accept one by one.</Trans>
					)}
				</p>
				{document.locked && (
					<p className="text-xs text-warning-soft-foreground">
						<Trans>This document is locked. Unlock it to get suggestions.</Trans>
					</p>
				)}
			</div>
			<PromptSuggestion>
				<PromptSuggestion.Items className="grid-cols-1">
					{suggestionsFor(document, prepare).map((suggestion, index) => (
						<PromptSuggestion.Item
							key={suggestion.label}
							isDisabled={disabled}
							showEndIcon={false}
							style={stagger(index)}
							className={ENTER_CLASS}
							onPress={() => onPick(suggestion.label)}
						>
							<Icon name={suggestion.icon} size={20} className="shrink-0 text-muted" />
							<span className="grid min-w-0 flex-1">
								<PromptSuggestion.ItemTitle className="truncate">{suggestion.label}</PromptSuggestion.ItemTitle>
								<PromptSuggestion.ItemDescription className="truncate">
									{suggestion.hint}
								</PromptSuggestion.ItemDescription>
							</span>
						</PromptSuggestion.Item>
					))}
				</PromptSuggestion.Items>
			</PromptSuggestion>
		</div>
	);
}

type PastConversationsProps = {
	threads: readonly ThreadSummary[];
	document: AssistantDocument;
	currentId: string | null;
	onOpen: (id: string) => void;
};

/** D3: conversations grouped by document, titled by their task, with what came of them. */
function PastConversations({ threads, document, currentId, onOpen }: PastConversationsProps) {
	const { i18n } = useLingui();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const mine = threads.filter((thread) => belongsTo(thread, document));
	const others = threads.filter(
		(thread) => !belongsTo(thread, document) && (thread.workingResumeId || thread.coverLetterId),
	);

	const outcome = (thread: ThreadSummary) =>
		thread.editsProposed === 0 ? t`no edits` : t`${thread.editsAccepted} of ${thread.editsProposed} edits accepted`;

	const open = (thread: ThreadSummary) => {
		if (belongsTo(thread, document)) return onOpen(thread.id);
		// Another document's conversation opens that document, with the assistant on it.
		if (thread.coverLetterId)
			void navigate({
				to: "/builder/letter/$coverLetterId",
				params: { coverLetterId: thread.coverLetterId },
				search: { assistant: thread.id },
			});
		else if (thread.workingResumeId)
			void navigate({
				to: "/builder/$resumeId",
				params: { resumeId: thread.workingResumeId },
				search: { assistant: thread.id },
			});
	};

	const remove = async (thread: ThreadSummary) => {
		const confirmed = await confirm(t`Delete this conversation?`, {
			description: t`Its messages and attachments are deleted. Edits you accepted stay in the document.`,
			confirmText: t`Delete conversation`,
		});
		if (!confirmed) return;
		try {
			await client.agent.threads.delete({ id: thread.id });
			await queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
			if (thread.id === currentId) useEditorStore.setState({ assistantThread: "new" });
		} catch (error) {
			toastError(error, t`Couldn't delete this conversation. Try again.`);
		}
	};

	const list = (items: readonly ThreadSummary[], label: string, detailOf: (thread: ThreadSummary) => string) => (
		<ChatListView aria-label={label} items={items}>
			{(thread) => (
				<ChatListView.Item
					id={thread.id}
					textValue={thread.title}
					className={cn(thread.id === currentId && "bg-default")}
					onAction={() => open(thread)}
				>
					<ChatListView.ItemContent>
						<ChatListView.Text>
							<ChatListView.Title>{thread.title}</ChatListView.Title>
							<ChatListView.Preview>{detailOf(thread)}</ChatListView.Preview>
						</ChatListView.Text>
						<ChatListView.Meta>
							<IconButton
								icon="x"
								label={t`Delete ${thread.title}`}
								size="sm"
								className="text-muted"
								onPress={() => void remove(thread)}
							/>
						</ChatListView.Meta>
					</ChatListView.ItemContent>
				</ChatListView.Item>
			)}
		</ChatListView>
	);

	return (
		<div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-3">
			<section aria-labelledby="assistant-this-document" className="grid gap-1">
				<h3 id="assistant-this-document" className="px-3 text-xs font-semibold text-muted">
					<Trans>This document</Trans>
				</h3>
				{mine.length > 0 ? (
					list(
						mine,
						t`This document`,
						(thread) => `${formatVersionTime(new Date(thread.lastMessageAt), i18n.locale)} · ${outcome(thread)}`,
					)
				) : (
					<p className="px-3 text-sm text-muted">
						<Trans>No conversations about this document yet.</Trans>
					</p>
				)}
			</section>
			{others.length > 0 && (
				<section aria-labelledby="assistant-other-documents" className="grid gap-1">
					<h3 id="assistant-other-documents" className="px-3 text-xs font-semibold text-muted">
						<Trans>Other documents · {others.length}</Trans>
					</h3>
					{list(
						others,
						t`Other documents`,
						(thread) =>
							`${formatVersionTime(new Date(thread.lastMessageAt), i18n.locale)} · ${outcome(thread)} · ${thread.coverLetterName ?? thread.resumeName ?? ""}`,
					)}
				</section>
			)}
		</div>
	);
}
