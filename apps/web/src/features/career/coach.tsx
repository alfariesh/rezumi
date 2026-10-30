import type { MessageContext } from "@/features/assistant/chat";
import type { RouterOutput } from "@/libs/orpc/client";
import type { IconName } from "@rezumi/ui/components/icon";
import type { UIMessage } from "ai";
import { ContextMenu, PromptSuggestion } from "@heroui-pro/react";
import {
	Description,
	Dropdown,
	Header,
	Label,
	ListBox,
	ScrollShadow,
	SearchField,
	Select,
	Separator,
	Spinner,
} from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import {
	CoachThread,
	connectionName,
	copyToClipboard,
	deleteConversation,
	titleFor,
	useCoachKnowledge,
} from "./coach-thread";
import { CareerLoadError } from "./load-state";
import { ContextChip, useNow } from "./shared";
import { transcriptOf, useConversationConnection } from "@/features/assistant/chat";
import { ProviderSetup } from "@/features/assistant/provider-setup";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

type ThreadSummary = RouterOutput["agent"]["threads"]["list"][number];
type UsableProvider = ReturnType<typeof useHasUsableAiProvider>["usableProviders"][number];

// ---- Context chips: per conversation, in this browser; new conversations start from the defaults. ----

type Chips = { application: boolean; memory: boolean; web: boolean; offers: boolean };
const DEFAULT_CHIPS: Chips = { application: true, memory: true, web: false, offers: true };
const chipsKey = (id: string) => `career-context:${id}`;

function readChips(id: string | null): Chips {
	if (!id) return DEFAULT_CHIPS;
	try {
		const raw = localStorage.getItem(chipsKey(id));
		return raw ? { ...DEFAULT_CHIPS, ...(JSON.parse(raw) as Partial<Chips>) } : DEFAULT_CHIPS;
	} catch {
		return DEFAULT_CHIPS;
	}
}

function writeChips(id: string, chips: Chips) {
	try {
		localStorage.setItem(chipsKey(id), JSON.stringify(chips));
	} catch {
		// A convenience: without storage the chips reset when the conversation reopens.
	}
}

function readOfferIds(id: string | null): string[] {
	if (!id) return [];
	try {
		const value: unknown = JSON.parse(localStorage.getItem(`career-offers:${id}`) ?? "[]");
		return Array.isArray(value)
			? value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 2)
			: [];
	} catch {
		return [];
	}
}

function writeOfferIds(id: string, offers: string[]) {
	try {
		localStorage.setItem(`career-offers:${id}`, JSON.stringify(offers));
	} catch {
		/* Storage may be unavailable. The URL still carries this session's selection. */
	}
}

/** The server's title for a conversation, from its first message, so the list doesn't change after a refetch. */
const titleOf = (text: string) => (text.length > 47 ? `${text.slice(0, 44)}...` : text);

type CoachPageProps = { conversationId: string | undefined; offerIds: string[] };

/** C7–C11: conversations about the whole search, with what each message shares chosen in the composer. */
export function CoachPage({ conversationId, offerIds: routeOfferIds }: CoachPageProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const providers = useHasUsableAiProvider();
	const threads = useQuery(orpc.agent.threads.list.queryOptions());
	const knowledge = useCoachKnowledge(null);
	const [modelMenuOpen, setModelMenuOpen] = useState(false);
	// Below lg the chat and the conversation list share the screen: one at a time, like a mail client.
	const [view, setView] = useState<"chat" | "history">("chat");
	const [providerId, setProviderId] = useState<string | null>(null);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
	const created = useRef<ThreadSummary | null>(null);

	// The conversation shown: the URL's, or the one just created here while the URL catches up. Arriving at the thread
	// that was just created keeps the chat mounted, so its first answer keeps streaming.
	const [session, setSession] = useState({ key: 0, created: null as string | null, url: conversationId });
	if (session.url !== conversationId) {
		const same = conversationId !== undefined && conversationId === session.created;
		setSession({
			key: same ? session.key : session.key + 1,
			created: same ? session.created : null,
			url: conversationId,
		});
	}
	const threadId = conversationId ?? session.created;
	const offerIds = routeOfferIds.length > 0 ? routeOfferIds : readOfferIds(threadId);
	useEffect(() => {
		if (threadId && routeOfferIds.length > 0) writeOfferIds(threadId, routeOfferIds);
	}, [threadId, routeOfferIds]);

	const [stored, setStored] = useState(() => ({ id: threadId, chips: readChips(threadId) }));
	if (stored.id !== threadId) {
		// The conversation just created here keeps the chips it was started with; storage may be blocked or full.
		const justCreated = stored.id === null && threadId !== null && threadId === session.created;
		setStored({ id: threadId, chips: justCreated ? stored.chips : readChips(threadId) });
	}
	const chips = stored.chips;
	const setChips = (next: Chips) => {
		setStored({ id: threadId, chips: next });
		if (threadId) writeChips(threadId, next);
	};

	const listKey = orpc.agent.threads.list.queryKey();
	const conversations = (threads.data ?? []).filter((thread) => thread.scope === "career" && !hidden.has(thread.id));
	const summary = threads.data?.find((thread) => thread.id === threadId);
	const usable = providers.usableProviders;
	// A conversation runs on its own connection; one switched off or removed moves to the default.
	const provider = usable.find((item) => item.id === (summary ? summary.aiProviderId : providerId)) ?? usable[0];
	useConversationConnection(summary, provider);
	const label = provider?.label ?? summary?.providerLabel ?? t`Your AI`;
	const connection = connectionName(label);

	const context: MessageContext = {
		// A career conversation has no document or posting to leave out.
		document: true,
		posting: true,
		application: chips.application,
		memory: chips.memory,
		web: chips.web,
		...(offerIds.length > 0 && chips.offers ? { offerIds } : {}),
	};

	const createThread = async () => {
		const thread = await client.agent.threads.start({
			scope: "career",
			...(provider ? { aiProviderId: provider.id } : {}),
		});
		created.current = thread;
		return thread.id;
	};

	const onThreadCreated = (id: string, text: string) => {
		queryClient.setQueryData(listKey, (old) => {
			const thread = old?.find((item) => item.id === id) ?? (created.current?.id === id ? created.current : undefined);
			if (!old || !thread) return old;
			return [{ ...thread, title: titleOf(text), lastMessageAt: new Date() }, ...old.filter((item) => item.id !== id)];
		});
		// No longer a draft: the URL names it from here on.
		created.current = null;
		writeChips(id, chips);
		writeOfferIds(id, offerIds);
		setSession((current) => ({ ...current, created: id }));
		void navigate({
			to: "/dashboard/coach/{-$conversationId}",
			params: { conversationId: id },
			search: offerIds.length > 0 ? { offers: offerIds } : {},
			replace: true,
		});
	};

	const chooseProvider = async (id: string) => {
		setProviderId(id);
		// A draft created for an attachment exists before the URL names it.
		const target = threadId ?? created.current?.id;
		if (!target) return;
		const chosen = usable.find((item) => item.id === id);
		queryClient.setQueryData(listKey, (old) =>
			old?.map((thread) =>
				thread.id === target ? { ...thread, aiProviderId: id, providerLabel: chosen?.label ?? null } : thread,
			),
		);
		try {
			await client.agent.threads.update({ id: target, aiProviderId: id });
		} catch (error) {
			toastError(error, t`Couldn't switch connections. Try again.`);
		}
		void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
	};

	const rename = async (thread: ThreadSummary, title: string) => {
		const next = title.trim();
		if (!next || next === thread.title || next === titleFor(thread)) return;
		queryClient.setQueryData(listKey, (old) =>
			old?.map((item) => (item.id === thread.id ? { ...item, title: next } : item)),
		);
		try {
			await client.agent.threads.update({ id: thread.id, title: next });
		} catch (error) {
			toastError(error, t`Couldn't rename this conversation. Try again.`);
		}
		void queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
	};

	const remove = (thread: ThreadSummary) =>
		deleteConversation(
			queryClient,
			thread.id,
			() => {
				setHidden((current) => new Set(current).add(thread.id));
				if (thread.id === threadId)
					void navigate({ to: "/dashboard/coach/{-$conversationId}", params: { conversationId: undefined } });
			},
			() =>
				setHidden((current) => {
					const next = new Set(current);
					next.delete(thread.id);
					return next;
				}),
		);

	const contextChips = (
		<>
			{chips.memory && knowledge.isError && <CareerLoadError onRetry={knowledge.retry} />}
			<ContextChip
				pressed={chips.application}
				onPressedChange={(application) => setChips({ ...chips, application })}
				label={t`Applications`}
				tooltip={t`Summaries of your open applications`}
			/>
			<ContextChip
				pressed={chips.memory}
				onPressedChange={(memory) => setChips({ ...chips, memory })}
				label={plural(knowledge.active.length, { one: "Knowledge · # fact", other: "Knowledge · # facts" })}
				tooltip={t`Facts, stories and preferences that are switched on in Knowledge`}
			/>
			<ContextChip
				pressed={chips.web}
				onPressedChange={(web) => setChips({ ...chips, web })}
				label={t`Web research`}
				tooltip={t`Lets the coach search public pages through your web search service`}
				offIcon="globe-hemisphere-west"
			/>
			{offerIds.length > 0 && (
				<ContextChip
					pressed={chips.offers}
					onPressedChange={(offers) => setChips({ ...chips, offers })}
					label={plural(offerIds.length, { one: "# saved offer", other: "# saved offers" })}
					tooltip={t`The offers you chose to compare, with their terms`}
				/>
			)}
		</>
	);

	// The copy button sits under the last message, at the start of the line.
	const afterMessages = (messages: readonly UIMessage[]) => (
		<IconButton
			icon="copy"
			label={t`Copy conversation`}
			size="sm"
			className="-ms-2 text-muted"
			onPress={() =>
				void copyToClipboard(
					transcriptOf(messages, { user: t`You`, assistant: t`Coach`, sources: t`Sources` }),
					t`Conversation copied`,
				)
			}
		/>
	);

	const model = (
		<>
			<IconButton
				icon="clock-counter-clockwise"
				label={t`Conversations`}
				size="sm"
				className="text-muted lg:hidden"
				onPress={() => setView("history")}
			/>
			{(usable.length > 0 || summary) && (
				<ModelSelect
					open={modelMenuOpen}
					onOpenChange={setModelMenuOpen}
					providers={usable}
					current={provider}
					label={label}
					onChoose={(id) => void chooseProvider(id)}
				/>
			)}
		</>
	);

	const notSetUp = threads.error instanceof ORPCError && threads.error.code === "PRECONDITION_FAILED";
	const noProvider = !providers.isUnavailable && !providers.hasUsableProvider;

	return (
		// The page fills what is left under the navbar; the chat and the list scroll inside it.
		<div className="flex h-[calc(100svh-3rem)] min-h-[480px] flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
			<ConversationList
				className={view === "history" ? "flex flex-1" : "hidden lg:flex"}
				threads={conversations}
				currentId={threadId}
				onClose={() => setView("chat")}
				onNavigate={() => setView("chat")}
				onRename={(thread, title) => void rename(thread, title)}
				onDelete={remove}
			/>
			<section
				aria-label={t`Coach`}
				className={cn(
					"min-h-0 min-w-0 flex-col px-3 pt-3 pb-3 lg:ps-1 lg:pe-4",
					view === "history" ? "hidden lg:flex" : "flex flex-1",
				)}
			>
				{notSetUp ? (
					<>
						<p className="m-4 rounded-xl bg-default p-4 text-sm text-muted">
							<Trans>
								The coach isn't set up on this server. Whoever runs it needs to set ENCRYPTION_SECRET. Knowledge, Offers
								and your applications work without it.
							</Trans>
						</p>
					</>
				) : providers.error ? (
					<AiProviderLoadState
						state={{
							...providers,
							retry: () => {
								providers.retry();
								void threads.refetch();
								knowledge.retry();
							},
						}}
					/>
				) : providers.isLoading || threads.isPending ? (
					<div className="grid flex-1 place-items-center">
						<Spinner size="md" color="current" className="text-muted" aria-label={t`Loading`} />
					</div>
				) : threads.isError && !threads.data ? (
					<CareerLoadError
						onRetry={() => {
							void threads.refetch();
							providers.retry();
						}}
					/>
				) : noProvider && !threadId ? (
					<>
						<div className="min-h-0 flex-1 overflow-y-auto">
							<div className="mx-auto max-w-[560px] py-6">
								<ProviderSetup />
							</div>
						</div>
					</>
				) : (
					<CoachThread
						key={session.key}
						draftKey={`career-coach:${threadId ?? "new"}`}
						threadId={threadId}
						createThread={createThread}
						onThreadCreated={onThreadCreated}
						applicationId={null}
						context={context}
						connection={connection}
						onChangeConnection={() => setModelMenuOpen(true)}
						header={() => null}
						afterMessages={afterMessages}
						empty={(send) => (
							<EmptyState
								disabled={noProvider || (chips.memory && (knowledge.isPending || knowledge.isError))}
								onPick={send}
							/>
						)}
						chips={contextChips}
						model={model}
						placeholder={t`Ask about your next career step…`}
						disabled={noProvider || (chips.memory && (knowledge.isPending || knowledge.isError))}
						variant="page"
					/>
				)}
			</section>
		</div>
	);
}

type EmptyStateProps = { disabled: boolean; onPick: (text: string) => void };

function EmptyState({ disabled, onPick }: EmptyStateProps) {
	const starters: Array<{ icon: IconName; text: string }> = [
		{ icon: "list-magnifying-glass", text: t`Which opportunities best match my priorities?` },
		{
			icon: "list-numbers",
			text: t`Help me turn an accomplishment into a Situation, Task, Action, Result and Reflection story.`,
		},
		{ icon: "user-sound", text: t`What interview answers should I practice?` },
	];
	return (
		<div className="grid gap-6 pt-[clamp(0px,6vh,48px)]">
			<div className="grid gap-3">
				<h3 className="text-3xl leading-9 font-semibold">
					<Trans>What are you working on?</Trans>
				</h3>
				<p className="text-[15px] leading-[23px] text-muted">
					<Trans>
						Ask about your search, or bring an accomplishment you want to explain better. Answers use what's switched on
						below and say what they relied on.
					</Trans>
				</p>
			</div>
			<PromptSuggestion variant="card" className="@container">
				<PromptSuggestion.Items className="grid-cols-1 @xl:grid-cols-3">
					{starters.map((starter) => (
						// In the card variant the item is a plain Card (a div): it takes no onPress or isDisabled, so a button
						// stretched over the card carries the press, focus and disabled state.
						<PromptSuggestion.Item key={starter.icon} className="relative cursor-[var(--cursor-interactive)]">
							<Icon name={starter.icon} size={22} className="text-accent" />
							<PromptSuggestion.ItemTitle>{starter.text}</PromptSuggestion.ItemTitle>
							<button
								type="button"
								aria-label={starter.text}
								disabled={disabled}
								onClick={() => onPick(starter.text)}
								className="absolute inset-0 rounded-[inherit] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed"
							/>
						</PromptSuggestion.Item>
					))}
				</PromptSuggestion.Items>
			</PromptSuggestion>
		</div>
	);
}

type ModelSelectProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providers: readonly UsableProvider[];
	current: UsableProvider | undefined;
	label: string;
	onChoose: (id: string) => void;
};

/** The connection this conversation uses, picked in the composer's toolbar like HeroUI's model selector. */
function ModelSelect({ open, onOpenChange, providers, current, label, onChoose }: ModelSelectProps) {
	const navigate = useNavigate();
	return (
		<Select
			aria-label={t`Connection`}
			placeholder={label}
			isOpen={open}
			onOpenChange={onOpenChange}
			className="w-[140px] sm:w-[190px]"
			value={current?.id ?? null}
			onChange={(key) => {
				if (key === "connect") void navigate({ to: "/dashboard/settings/ai" });
				else if (typeof key === "string") onChoose(key);
			}}
		>
			<Select.Trigger className="h-8 min-h-8 text-[13px]">
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{providers.map((item) => (
						<ListBox.Item key={item.id} id={item.id} textValue={`${item.label} ${item.model}`}>
							<span className="grid min-w-0">
								<Label className="truncate">{item.label}</Label>
								<Description className="truncate">{item.model}</Description>
							</span>
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
					<ListBox.Item id="connect" textValue={t`Connect another…`}>
						<Label>
							<Trans>Connect another…</Trans>
						</Label>
					</ListBox.Item>
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

// ---- Conversations ----

type ConversationListProps = {
	threads: ThreadSummary[];
	currentId: string | null;
	className: string;
	/** Below lg: back to the chat without choosing. */
	onClose: () => void;
	onNavigate: () => void;
	onRename: (thread: ThreadSummary, title: string) => void;
	onDelete: (thread: ThreadSummary) => void;
};

type Activity = "all" | "today" | "week" | "month";
type SortBy = "activity" | "title";

/**
 * Past conversations, on the left of the chat (a mail client's list): a title each. Search matches titles; the
 * filter menu narrows by last activity and sorts. Below lg it replaces the chat until one is chosen. A conversation
 * renames in place and deletes with Undo.
 */
function ConversationList({
	threads,
	currentId,
	className,
	onClose,
	onNavigate,
	onRename,
	onDelete,
}: ConversationListProps) {
	const navigate = useNavigate();
	const [renaming, setRenaming] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [activity, setActivity] = useState<Activity>("all");
	const [sortBy, setSortBy] = useState<SortBy>("activity");
	const now = useNow();
	const needle = query.trim().toLocaleLowerCase();
	const days = { all: Infinity, today: 1, week: 7, month: 30 }[activity];
	const filtered = activity !== "all" || sortBy !== "activity";
	const shown = threads
		.filter(
			(thread) =>
				(!needle || titleFor(thread).toLocaleLowerCase().includes(needle)) &&
				now.getTime() - new Date(thread.lastMessageAt).getTime() < days * 86_400_000,
		)
		.sort((a, b) =>
			sortBy === "title"
				? titleFor(a).localeCompare(titleFor(b))
				: new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
		);
	const options = <T extends string>(title: string, value: T, onChange: (next: T) => void, items: [T, string][]) => (
		<Dropdown.Section
			selectionMode="single"
			disallowEmptySelection
			selectedKeys={new Set([value])}
			onSelectionChange={(keys) => {
				const [next] = keys === "all" ? [] : keys;
				if (typeof next === "string") onChange(next as T);
			}}
		>
			<Header>{title}</Header>
			{items.map(([id, label]) => (
				<Dropdown.Item key={id} id={id} textValue={label}>
					<Label>{label}</Label>
					<Dropdown.ItemIndicator />
				</Dropdown.Item>
			))}
		</Dropdown.Section>
	);

	return (
		<nav
			aria-label={t`Conversations`}
			className={cn("min-h-0 flex-col gap-3 px-3 pt-3 pb-3 lg:ps-4 lg:pe-1", className)}
		>
			<div className="flex items-center gap-2">
				<IconButton icon="arrow-left" label={t`Back to the chat`} size="sm" className="lg:hidden" onPress={onClose} />
				<SearchField aria-label={t`Search conversations`} className="min-w-0 flex-1" value={query} onChange={setQuery}>
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input placeholder={t`Search…`} />
						<SearchField.ClearButton />
					</SearchField.Group>
				</SearchField>
				<IconButton
					icon="note-pencil"
					label={t`New conversation`}
					onPress={() => {
						onNavigate();
						void navigate({ to: "/dashboard/coach/{-$conversationId}", params: { conversationId: undefined } });
					}}
				/>
			</div>

			<div className="flex items-center justify-between ps-3">
				<h2 className="text-xs font-semibold text-muted">
					<Trans>Recents</Trans>
				</h2>
				<Dropdown>
					<IconButton
						icon="sliders-horizontal"
						label={t`Filter conversations`}
						size="sm"
						iconSize={16}
						className={cn("text-muted", filtered && "bg-default text-foreground")}
					/>
					<Dropdown.Popover placement="bottom end" className="w-56">
						<Dropdown.Menu>
							{options<Activity>(t`Last activity`, activity, setActivity, [
								["all", t`All`],
								["today", t`Today`],
								["week", t`Past 7 days`],
								["month", t`Past 30 days`],
							])}
							<Separator />
							{options<SortBy>(t`Sort by`, sortBy, setSortBy, [
								["activity", t`Last activity`],
								["title", t`Title`],
							])}
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
			</div>

			<ScrollShadow hideScrollBar className="min-h-0 flex-1 overflow-y-auto">
				<ul className="grid content-start gap-0.5">
					{currentId === null && !needle && (
						<li aria-current="page" className="rounded-xl bg-default px-3 py-2 text-sm leading-5 font-medium">
							<Trans>New conversation</Trans>
						</li>
					)}
					{shown.map((thread) => (
						<ConversationItem
							key={thread.id}
							thread={thread}
							current={thread.id === currentId}
							renaming={renaming === thread.id}
							onRenameStart={() => setRenaming(thread.id)}
							onRenameEnd={(title) => {
								setRenaming(null);
								if (title !== null) onRename(thread, title);
							}}
							onDelete={() => onDelete(thread)}
							onNavigate={onNavigate}
						/>
					))}
				</ul>
				{threads.length > 0 && shown.length === 0 && (
					<p className="px-3 py-10 text-center text-sm text-muted">
						<Trans>No conversations match.</Trans>
					</p>
				)}
				{threads.length === 0 && currentId !== null && (
					<p className="px-3 py-10 text-center text-sm text-muted">
						<Trans>Your conversations appear here.</Trans>
					</p>
				)}
			</ScrollShadow>
		</nav>
	);
}

type ConversationItemProps = {
	thread: ThreadSummary;
	current: boolean;
	renaming: boolean;
	onRenameStart: () => void;
	/** The new title, or null when renaming was cancelled. */
	onRenameEnd: (title: string | null) => void;
	onDelete: () => void;
	onNavigate: () => void;
};

/** A conversation's title: open it; the hover ⋯ or a right-click renames (in place) or deletes it (with Undo). */
function ConversationItem({
	thread,
	current,
	renaming,
	onRenameStart,
	onRenameEnd,
	onDelete,
	onNavigate,
}: ConversationItemProps) {
	const cancelled = useRef(false);
	const title = titleFor(thread);

	return (
		<ContextMenu>
			<ContextMenu.Trigger<"li"> render={(props) => <li {...props} />} className="group/row relative">
				{renaming ? (
					<input
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- Rename was just chosen; typing goes straight into the name
						autoFocus
						defaultValue={title}
						aria-label={t`Conversation name`}
						maxLength={200}
						onFocus={(event) => event.currentTarget.select()}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								event.currentTarget.blur();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								cancelled.current = true;
								event.currentTarget.blur();
							}
						}}
						onBlur={(event) => {
							onRenameEnd(cancelled.current ? null : event.currentTarget.value);
							cancelled.current = false;
						}}
						className="h-9 w-full rounded-xl border border-accent bg-overlay px-3 text-base outline-none md:text-sm"
					/>
				) : (
					<Link
						to="/dashboard/coach/{-$conversationId}"
						params={{ conversationId: thread.id }}
						aria-current={current ? "page" : undefined}
						onClick={onNavigate}
						className={cn(
							"flex items-center gap-2 rounded-xl py-2 ps-3 pe-9 text-sm leading-5",
							current ? "bg-default font-medium" : "hover:bg-default/60",
						)}
					>
						<span className="truncate">{title}</span>
						{thread.activeRunId && (
							<>
								<span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
								<span className="sr-only">
									<Trans>Writing</Trans>
								</span>
							</>
						)}
					</Link>
				)}
				{!renaming && (
					<Dropdown>
						<IconButton
							icon="dots-three"
							iconSize={18}
							size="sm"
							label={t`More for ${title}`}
							className="absolute inset-e-1 top-1 size-7 min-w-0 text-muted opacity-0 transition-[opacity,background-color,color] duration-quick group-hover/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
						/>
						<Dropdown.Popover placement="bottom end">
							<Dropdown.Menu>
								<Dropdown.Item id="rename" textValue={t`Rename`} onAction={onRenameStart}>
									<Icon name="pencil-simple" size={18} />
									<Label>
										<Trans>Rename</Trans>
									</Label>
								</Dropdown.Item>
								<Dropdown.Item id="delete" textValue={t`Delete`} variant="danger" onAction={onDelete}>
									<Icon name="trash" size={18} />
									<Label>
										<Trans>Delete</Trans>
									</Label>
								</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown>
				)}
			</ContextMenu.Trigger>
			<ContextMenu.Popover>
				<ContextMenu.Menu>
					<ContextMenu.Item id="rename" textValue={t`Rename`} onAction={onRenameStart}>
						<Icon name="pencil-simple" size={18} />
						<Label>
							<Trans>Rename</Trans>
						</Label>
					</ContextMenu.Item>
					<ContextMenu.Item id="delete" textValue={t`Delete`} variant="danger" onAction={onDelete}>
						<Icon name="trash" size={18} />
						<Label>
							<Trans>Delete</Trans>
						</Label>
					</ContextMenu.Item>
				</ContextMenu.Menu>
			</ContextMenu.Popover>
		</ContextMenu>
	);
}
