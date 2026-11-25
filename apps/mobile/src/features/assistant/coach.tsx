import type { MessageContext } from "./chat";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { formatList } from "@rezumi/utils/locale";
import { useThreads } from "./chat";
import { ChatView } from "./chat-view";
import { ContextChip } from "./composer";
import { PanelBar } from "./panel-bar";
import { ModelButton, ModelSheet, ProviderGate, useConversationProvider } from "./provider";
import { PastConversations, useThreadTitle } from "./threads";
import { client, orpc } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/providers";
import { Button, EmptyState, Icon, ListGroup, ListRow, Text, Typography, cx } from "@/ui";

type Chips = { application: boolean; memory: boolean; web: boolean; offers: boolean };
const DEFAULT_CHIPS: Chips = { application: true, memory: true, web: false, offers: true };

/** Expo Router gives one value or several for `?offers=`; at most two offers are compared. */
export function offerIdsFrom(value: string | string[] | undefined) {
	return (Array.isArray(value) ? value : value ? [value] : [])
		.flatMap((item) => item.split(","))
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 2);
}

/** Shared, switched-on facts and usable stories, as the server's career context counts them (web: useCoachKnowledge). */
function useCoachProfile() {
	const session = useSession();
	const enabled = session.status === "signed-in";
	const factsOptions = orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } });
	const storiesOptions = orpc.career.stories.queryOptions({ input: { applicationId: null } });
	const facts = useQuery({ ...factsOptions, queryKey: [...factsOptions.queryKey, session.server], enabled });
	const stories = useQuery({ ...storiesOptions, queryKey: [...storiesOptions.queryKey, session.server], enabled });
	const active = (facts.data ?? []).filter((fact) => fact.status === "active" && fact.applicationId === null);
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
		isPending: facts.isPending || stories.isPending,
		isError: facts.isError || stories.isError,
		retry: () => {
			void facts.refetch();
			void stories.refetch();
		},
		facts: active.length,
		stories: usable.length,
	};
}

type CoachProps = {
	offerIds?: readonly string[] | undefined;
	initialThread?: string | undefined;
	onClose: () => void;
	expand?: { expanded: boolean; onPress: () => void } | undefined;
};

const noOffers: readonly string[] = [];

export function Coach(props: CoachProps) {
	const { t } = useLingui();
	const session = useSession();
	const scope = getAccountScope();
	return session.status === "signed-in" && scope ? (
		<CoachConversation key={scope} {...props} />
	) : (
		<EmptyState
			kind="page"
			icon="sparkle"
			title={t`Sign in to use Coach`}
			action={{ label: t`Close`, onPress: props.onClose }}
		/>
	);
}

function CoachConversation({ offerIds = noOffers, initialThread, onClose, expand }: CoachProps) {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const providers = useHasAIProvider();
	const threads = useThreads();
	const profile = useCoachProfile();
	const [threadId, setThreadId] = useState<string | null>(initialThread ?? null);
	const [draftKey, setDraftKey] = useState(0);
	const [chips, setChips] = useState<Chips>(DEFAULT_CHIPS);
	const [history, setHistory] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const conversations = (threads.data ?? []).filter((thread) => thread.scope === "career");
	const summary = conversations.find((thread) => thread.id === threadId);
	const { provider, label, sourceNote, switching, choose } = useConversationProvider(providers, summary, threadId);
	const title = useThreadTitle();
	const invalidLink = !!initialThread && threadId === initialThread && !summary;
	const blocked = chips.memory && (profile.isPending || profile.isError);
	const disabled = blocked || switching || !providers.hasAIProvider;
	const context: MessageContext = {
		document: true,
		posting: true,
		application: chips.application,
		memory: chips.memory,
		web: chips.web,
		...(offerIds.length > 0 && chips.offers ? { offerIds: [...offerIds] } : {}),
	};
	const parts = [
		t`your message`,
		t`earlier messages in this chat`,
		...(chips.application ? [t`application summaries`] : []),
		...(context.offerIds ? [plural(offerIds.length, { one: "# saved offer", other: "# saved offers" })] : []),
		...(chips.memory
			? [
					t`your preferences`,
					...(profile.facts > 0 ? [plural(profile.facts, { one: "# fact", other: "# facts" })] : []),
					...(profile.stories > 0 ? [t`your stories`] : []),
				]
			: []),
	];
	const list = formatList(i18n.locale, parts);
	const privacy = blocked
		? profile.isError
			? t`Your Profile couldn't load. Try again or switch Profile off before sending.`
			: t`Loading your Profile before you send…`
		: [
				t`When you tap send, ${list} go to ${label}.`,
				...(chips.web ? [t`Search terms go to your web search service.`] : []),
			].join(" ");
	const open = (id: string | null) => {
		setThreadId(id);
		setChips(DEFAULT_CHIPS);
		setDraftKey((key) => key + 1);
		setHistory(false);
	};
	const refresh = () =>
		Promise.allSettled([
			threads.refetch(),
			queryClient.invalidateQueries({ queryKey: orpc.career.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.applications.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.aiProviders.key() }),
		]);

	return (
		<View className="flex-1 bg-surface" testID="coach-panel">
			<PanelBar
				title={t`Coach`}
				onClose={onClose}
				expand={expand}
				onNew={() => open(null)}
				onHistory={() => setHistory(!history)}
				showHistory={history}
				subtitle={
					<View className="flex-row flex-wrap items-center gap-2">
						{summary ? (
							<Text size="xs" tone="muted" numberOfLines={1} className="shrink">
								{title(summary)}
							</Text>
						) : null}
						{provider ? <ModelButton label={provider.model} onPress={() => setModelOpen(true)} /> : null}
						{blocked && profile.isError ? (
							<Button size="sm" variant="ghost" onPress={profile.retry}>
								<Button.Label>
									<Trans>Retry</Trans>
								</Button.Label>
							</Button>
						) : null}
					</View>
				}
			/>
			<ProviderGate
				providers={providers}
				readOnly={history || threadId !== null}
				threadsError={threads.error}
				loading={threads.isPending}
				onRetry={() => void refresh()}
				notSetUp={t`The server operator needs to configure AI before Coach can start.`}
			>
				{threads.isError ? (
					<EmptyState
						kind="page"
						icon="warning-circle"
						title={t`Conversations couldn't load.`}
						action={{ label: t`Retry`, onPress: () => void refresh() }}
					/>
				) : (
					<>
						{history ? (
							<PastConversations
								threads={conversations}
								currentId={threadId}
								onOpen={(thread) => open(thread.id)}
								onDeleted={(id) => {
									if (id === threadId) open(null);
								}}
							/>
						) : null}
						<View className={cx("flex-1", history && "hidden")}>
							{invalidLink ? (
								<EmptyState
									kind="page"
									icon="warning-circle"
									title={t`This conversation couldn't be opened.`}
									action={{ label: t`New conversation`, onPress: () => open(null) }}
								/>
							) : (
								<ChatView
									key={draftKey}
									threadId={threadId}
									createThread={async (scope) =>
										(
											await client.agent.threads.start(
												{ scope: "career", ...(provider ? { aiProviderId: provider.id } : {}) },
												{ context: { scope } },
											)
										).id
									}
									onThreadCreated={(id) => {
										setThreadId(id);
										void threads.refetch();
									}}
									context={context}
									document={null}
									onRefresh={refresh}
									sourceNote={sourceNote}
									privacy={privacy}
									placeholder={t`Ask about your next career step…`}
									assistantName={t`Coach`}
									disabled={disabled}
									onSwitchModel={() => setModelOpen(true)}
									onFinish={() => {
										void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
										void queryClient.invalidateQueries({ queryKey: orpc.career.stories.key() });
										void queryClient.invalidateQueries({ queryKey: orpc.billing.summary.key() });
									}}
									chips={
										<>
											<ContextChip
												icon="briefcase"
												label={t`Applications`}
												pressed={chips.application}
												onPress={() => setChips({ ...chips, application: !chips.application })}
											/>
											<ContextChip
												icon="brain"
												label={t`Profile`}
												pressed={chips.memory}
												onPress={() => setChips({ ...chips, memory: !chips.memory })}
											/>
											<ContextChip
												icon="globe-hemisphere-west"
												label={t`Web research`}
												pressed={chips.web}
												onPress={() => setChips({ ...chips, web: !chips.web })}
											/>
											{offerIds.length > 0 ? (
												<ContextChip
													icon="hand-heart"
													label={plural(offerIds.length, { one: "# saved offer", other: "# saved offers" })}
													pressed={chips.offers}
													onPress={() => setChips({ ...chips, offers: !chips.offers })}
												/>
											) : null}
										</>
									}
									empty={(send) => <CoachStarters disabled={disabled} onPick={send} />}
								/>
							)}
						</View>
					</>
				)}
			</ProviderGate>
			<ModelSheet
				open={modelOpen}
				onClose={() => setModelOpen(false)}
				providers={providers.usableProviders}
				currentId={provider?.id}
				onChoose={(id) => void choose(id)}
			/>
		</View>
	);
}

type CoachStartersProps = { disabled: boolean; onPick: (text: string) => void };

function CoachStarters({ disabled, onPick }: CoachStartersProps) {
	const { t } = useLingui();
	const starters = [
		{ icon: "list-magnifying-glass", text: t`Which opportunities best match my priorities?` },
		{
			icon: "list-numbers",
			text: t`Help me turn an accomplishment into a Situation, Task, Action, Result and Reflection story.`,
		},
		{ icon: "user-sound", text: t`What interview answers should I practice?` },
	] as const;
	return (
		<View className="gap-4">
			<Icon name="sparkle" tone="accent" size={24} />
			<Typography.Heading type="h4">
				<Trans>What are you working on?</Trans>
			</Typography.Heading>
			<ListGroup>
				{starters.map(({ icon, text }) => (
					<ListRow key={icon} icon={icon} title={text} isDisabled={disabled} onPress={() => onPick(text)} />
				))}
			</ListGroup>
		</View>
	);
}
