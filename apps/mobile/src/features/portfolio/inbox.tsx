import type { PortfolioMessage } from "./queries";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { OfflinePortfolioNotice, PortfolioLoadState, PortfolioPage } from "./layout";
import { openPortfolioLink, portfolioFailure } from "./queries";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { useIsTablet } from "@/shell/use-is-tablet";
import { Button, Card, Chip, EmptyState, ListRow, ListSection, Screen, Sheet, Text, Typography, showToast } from "@/ui";

const inboxOptions = () =>
	orpc.portfolio.messages.list.infiniteOptions({
		input: (cursor: string | null) => ({ limit: 20, ...(cursor ? { cursor } : {}) }),
		initialPageParam: null as string | null,
		getNextPageParam: (page) => page.nextCursor,
	});

export function PortfolioInboxScreen() {
	const { t, i18n } = useLingui();
	const online = useOnline();
	const tablet = useIsTablet();
	const cache = useQueryClient();
	const inbox = useInfiniteQuery({ ...inboxOptions(), enabled: online });
	const [selected, setSelected] = useState<string | null>(null);
	const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];
	const unread = inbox.data?.pages[0]?.unread ?? 0;
	const message = items.find((item) => item.id === selected);
	const action = useMutation({
		mutationFn: async (task: { id: string; read: boolean } | { id: string; delete: true }) => {
			if ("delete" in task) await client.portfolio.messages.delete({ id: task.id });
			else await client.portfolio.messages.markRead(task);
		},
		onSuccess: async (_, task) => {
			if ("delete" in task) setSelected((current) => (current === task.id ? null : current));
			await cache.invalidateQueries({ queryKey: orpc.portfolio.messages.list.key() });
		},
		onError: (error) => showToast({ title: portfolioFailure(error), variant: "danger" }),
	});
	const open = (item: PortfolioMessage) => {
		setSelected(item.id);
		if (!item.readAt && online && !action.isPending) action.mutate({ id: item.id, read: true });
	};
	const disabled = !online || action.isPending;
	const detail = message ? (
		<MessageDetail
			key={message.id}
			message={message}
			disabled={disabled}
			mark={() => action.mutate({ id: message.id, read: !message.readAt })}
			remove={() => action.mutate({ id: message.id, delete: true })}
		/>
	) : null;

	return (
		<PortfolioPage title={t`Inbox`}>
			{!inbox.data ? (
				<PortfolioLoadState offline={!online} error={inbox.isError} retry={() => void inbox.refetch()} />
			) : (
				<View className="flex-1 flex-row">
					<Screen onRefresh={inbox.refetch} testID="portfolio-inbox">
						{online ? null : <OfflinePortfolioNotice />}
						{items.length ? (
							<ListSection title={plural(unread, { one: "# unread message", other: "# unread messages" })}>
								{items.map((item) => (
									<ListRow
										key={item.id}
										testID={`portfolio-message-${item.id}`}
										title={item.name}
										description={item.body.replace(/\s+/g, " ").trim().slice(0, 72)}
										value={new Date(item.createdAt).toLocaleDateString(i18n.locale, { month: "short", day: "numeric" })}
										isSelected={tablet && item.id === selected}
										trailing={
											item.readAt ? undefined : (
												<Chip size="sm" color="accent">
													<Chip.Label>{t`Unread`}</Chip.Label>
												</Chip>
											)
										}
										onPress={() => open(item)}
									/>
								))}
							</ListSection>
						) : (
							<EmptyState
								kind="page"
								icon="envelope"
								title={t`No messages yet`}
								description={t`Messages sent through your portfolio contact form appear here.`}
							/>
						)}
						{inbox.hasNextPage ? (
							<Button
								variant="secondary"
								isDisabled={!online || inbox.isFetching}
								onPress={() => void inbox.fetchNextPage()}
							>
								{inbox.isFetchNextPageError ? t`Retry` : t`Load more messages`}
							</Button>
						) : null}
					</Screen>
					{tablet && items.length ? (
						<Screen>{detail ?? <EmptyState kind="inline" title={t`Choose a message to read it.`} />}</Screen>
					) : null}
				</View>
			)}
			{!tablet && message ? (
				<Sheet
					isOpen
					onOpenChange={(open) => {
						if (!open) setSelected(null);
					}}
					title={t`Message`}
					closeLabel={t`Close`}
					detents={[0.8, 1]}
				>
					{detail}
				</Sheet>
			) : null}
		</PortfolioPage>
	);
}

type MessageDetailProps = {
	message: PortfolioMessage;
	disabled: boolean;
	mark: () => void;
	remove: () => void;
};

function MessageDetail({ message, disabled, mark, remove }: MessageDetailProps) {
	const { t, i18n } = useLingui();
	const [confirm, setConfirm] = useState(false);
	return (
		<Card className="gap-4">
			<View className="gap-1">
				<Typography.Heading type="h5">{message.name}</Typography.Heading>
				<Text selectable tone="muted">
					{message.email}
				</Text>
				<Text size="xs" tone="muted">
					{new Date(message.createdAt).toLocaleString(i18n.locale, { dateStyle: "medium", timeStyle: "short" })}
				</Text>
			</View>
			{message.serviceTitle ? <Text weight="medium">{message.serviceTitle}</Text> : null}
			<Text selectable>{message.body}</Text>
			<View className="flex-row flex-wrap gap-2">
				<Button
					onPress={() => void openPortfolioLink(`mailto:${encodeURIComponent(message.email).replaceAll("%40", "@")}`)}
				>{t`Reply by email`}</Button>
				<Button variant="secondary" isDisabled={disabled} onPress={mark}>
					{message.readAt ? t`Mark unread` : t`Mark read`}
				</Button>
				<Button
					variant="danger-soft"
					isDisabled={disabled || confirm}
					onPress={() => setConfirm(true)}
				>{t`Delete`}</Button>
			</View>
			{confirm ? (
				<View className="gap-2 rounded-xl border border-border p-3">
					<Text weight="semibold">{t`Delete this message?`}</Text>
					<Text tone="muted">{t`It will be permanently removed from your inbox.`}</Text>
					<View className="flex-row flex-wrap gap-2">
						<Button variant="danger" isDisabled={disabled} onPress={remove}>{t`Delete message`}</Button>
						<Button variant="secondary" onPress={() => setConfirm(false)}>{t`Keep message`}</Button>
					</View>
				</View>
			) : null}
		</Card>
	);
}
