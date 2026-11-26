import type { IconName, InputRef } from "@/ui";
import type { Href } from "expo-router";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { SectionList, View } from "react-native";
import { rank } from "./rank";
import { useApplications } from "@/features/applications/queries";
import { useThreads } from "@/features/assistant/chat";
import { useDocuments } from "@/features/documents/queries";
import { usePortfolioEnabled } from "@/features/home/queries";
import { routes } from "@/routes";
import { useAccountLinks } from "@/shell/account-menu";
import { useKeyCommands } from "@/shell/key-commands";
import { EmptyState, IconButton, ListGroup, ListRow, Screen, SearchField, Separator, Text } from "@/ui";
import { ChatFrame } from "@/ui/keyboard";

type Row = {
	key: string;
	title: string;
	description?: string | undefined;
	icon: IconName;
	href: Href;
	keywords?: readonly (string | null | undefined)[] | undefined;
	time?: number;
};

type SearchGroup = { key: string; title: string; data: Row[] };

export function SearchScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const input = useRef<InputRef>(null);
	const term = query.trim();
	const portfolio = usePortfolioEnabled();
	const account = useAccountLinks();
	const documents = useDocuments();
	const applications = useApplications();
	const conversations = useThreads(!!term);
	const go = (href: Href) => router.dismissTo(href);
	useKeyCommands([{ id: "search", input: "k", title: t`Search`, run: () => input.current?.focus() }]);

	const pages: Row[] = [
		{ key: "home", title: t`Home`, icon: "house", href: routes.home() },
		{
			key: "documents",
			title: t`Documents`,
			icon: "file-text",
			href: routes.documents(),
			keywords: [t`Resumes`, t`Cover letters`],
		},
		{ key: "applications", title: t`Applications`, icon: "briefcase", href: routes.applications() },
		{ key: "jobs", title: t`Jobs`, icon: "magnifying-glass", href: routes.applications("jobs") },
		...(portfolio
			? [{ key: "portfolio", title: t`Portfolio`, icon: "globe", href: routes.portfolio() } satisfies Row]
			: []),
		{ key: "profile", title: t`Profile`, icon: "user-circle", href: routes.profile() },
		{ key: "coach", title: t`Coach`, icon: "sparkle", href: routes.coach() },
		...account.map(({ id, label, icon, href }) => ({
			key: id,
			title: label,
			icon,
			href,
			keywords:
				id === "settings"
					? [t`Theme`, t`Language`, t`Timezone`, t`Notifications`]
					: id === "account"
						? [t`Password`, t`Passkeys`, t`Export data`, t`Delete account`]
						: [],
		})),
		{ key: "new", title: t`New document`, icon: "plus", href: routes.new() },
		{ key: "trash", title: t`Trash`, icon: "trash", href: routes.trash() },
		{ key: "ats", title: t`ATS checker`, icon: "seal-check", href: routes.atsChecker() },
	];
	const documentRows: Row[] = (documents.data ?? []).map((document) => ({
		key: `${document.type}:${document.id}`,
		icon: document.type === "resume" ? "file-text" : "envelope-simple",
		title: document.name,
		description: document.application ? t`Linked to ${document.application.company}` : undefined,
		keywords: [document.slug, ...document.tags, document.application?.company, document.application?.role],
		time: document.updatedAt.getTime(),
		href: document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id),
	}));
	const applicationRows: Row[] = (applications.data ?? []).map((application) => ({
		key: application.id,
		icon: "briefcase",
		title: application.company,
		description: application.role,
		keywords: [application.role],
		time: application.updatedAt.getTime(),
		href: routes.application(application.id),
	}));
	const conversationRows: Row[] = (conversations.data ?? []).flatMap((thread) => {
		let href: Href;
		if (thread.scope === "career" || thread.scope === "application") href = routes.coachThread(thread.id);
		else if (thread.portfolioId && portfolio)
			href = { pathname: routes.portfolio("edit"), params: { thread: thread.id } };
		else if (thread.coverLetterId)
			href = { pathname: routes.letterAssistant(thread.coverLetterId), params: { thread: thread.id } };
		else if (thread.workingResumeId)
			href = { pathname: routes.assistant(thread.workingResumeId), params: { thread: thread.id } };
		else return [];
		return [
			{
				key: thread.id,
				icon: "chat-text",
				title: thread.title,
				description:
					thread.coverLetterName ?? thread.resumeName ?? (thread.portfolioId ? t`Portfolio assistant` : t`Coach`),
				keywords: [thread.resumeName, thread.coverLetterName],
				time: thread.lastMessageAt.getTime(),
				href,
			},
		];
	});
	const groups: SearchGroup[] = term
		? [
				{ key: "documents", title: t`Documents`, data: rank(term, documentRows) },
				{ key: "applications", title: t`Applications`, data: rank(term, applicationRows) },
				{ key: "conversations", title: t`Conversations`, data: rank(term, conversationRows) },
				{ key: "pages", title: t`Go to…`, data: rank(term, pages) },
			].filter(({ data }) => data.length > 0)
		: [{ key: "pages", title: t`Go to…`, data: pages }];
	const first = groups[0]?.data[0];
	const pending =
		!!term &&
		[documents, applications, conversations].some((read) => read.isPending && read.fetchStatus === "fetching");
	const failed =
		!!term && [documents, applications, conversations].some((read) => read.isError || read.fetchStatus === "paused");
	const ask = term ? routes.coachQuestion(term) : null;
	const close = () => (router.canGoBack() ? router.back() : router.replace(routes.home()));

	return (
		<Screen scroll={false} bare edges={["top", "bottom"]} testID="global-search">
			<ChatFrame>
				<View className="flex-row items-center gap-2 px-4 py-3">
					<SearchField value={query} onChange={setQuery} className="flex-1">
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input
								ref={input}
								testID="global-search-input"
								autoFocus
								autoCorrect={false}
								autoCapitalize="none"
								accessibilityLabel={t`Search`}
								placeholder={t`Search documents, applications, and more`}
								returnKeyType="search"
								onSubmitEditing={() => {
									if (term && first) go(first.href);
								}}
							/>
							<SearchField.ClearButton />
						</SearchField.Group>
					</SearchField>
					<IconButton icon="x" label={t`Close search`} onPress={close} />
				</View>
				<SectionList
					sections={groups}
					keyExtractor={(row) => row.key}
					contentContainerClassName="px-4 pb-4"
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					stickySectionHeadersEnabled={false}
					renderSectionHeader={({ section }) => (
						<Text size="xs" weight="semibold" tone="muted" className="px-1 py-2" accessibilityRole="header">
							{section.title}
						</Text>
					)}
					renderItem={({ item }) => (
						<ListGroup>
							<ListRow
								title={item.title}
								description={item.description}
								icon={item.icon}
								onPress={() => go(item.href)}
							/>
						</ListGroup>
					)}
					ItemSeparatorComponent={Separator}
					ListEmptyComponent={
						term && !pending && !failed ? (
							<EmptyState kind="filtered" title={t`No results match your search.`} />
						) : undefined
					}
					ListFooterComponent={
						<View className="gap-2">
							{pending ? <Text tone="muted" className="py-2">{t`Searching…`}</Text> : null}
							{failed ? (
								<EmptyState
									kind="inline"
									title={t`Some results couldn't load.`}
									action={{
										label: t`Try again`,
										onPress: () =>
											void Promise.allSettled([documents.refetch(), applications.refetch(), conversations.refetch()]),
									}}
								/>
							) : null}
							{ask ? (
								<ListGroup className="mt-2">
									<ListRow icon="sparkle" title={t`Ask Coach “${term}”`} onPress={() => go(ask)} />
								</ListGroup>
							) : null}
						</View>
					}
				/>
			</ChatFrame>
		</Screen>
	);
}
