import { Widget } from "@heroui-pro/react";
import { Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { portfolioErrorMessage } from "../errors";
import { invalidatePortfolioQueries } from "../status";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { useConfirm } from "@/hooks/use-confirm";
import { client, orpc } from "@/libs/orpc/client";

type Message = Awaited<ReturnType<typeof client.portfolio.messages.list>>["items"][number];

type MessageRowProps = { message: Message };

/** One message: who wrote it and how to answer, what it says, and what can be done with it. */
function MessageRow({ message }: MessageRowProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [busy, setBusy] = useState(false);
	const unread = message.readAt === null;
	const { name } = message;

	const run = async (action: () => Promise<unknown>, failure: string) => {
		setBusy(true);
		try {
			await action();
			await invalidatePortfolioQueries(queryClient);
		} catch (error) {
			toast.add({ type: "error", description: portfolioErrorMessage(error, { fallback: failure }) });
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		const confirmed = await confirm(t`Delete the message from ${name}?`, {
			description: t`It's deleted for good.`,
			confirmText: t`Delete message`,
		});
		if (confirmed)
			await run(() => client.portfolio.messages.delete({ id: message.id }), t`Couldn't delete it. Try again.`);
	};

	return (
		<li className="grid gap-2 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
				<p className="flex min-w-0 items-center gap-2 font-semibold">
					{unread && (
						<>
							<span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
							<span className="sr-only">
								<Trans>Unread:</Trans>
							</span>
						</>
					)}
					<span className="min-w-0 truncate">{message.name}</span>
				</p>
				<time className="text-xs text-muted tabular-nums" dateTime={message.createdAt.toISOString()}>
					{message.createdAt.toLocaleString(i18n.locale, { dateStyle: "medium", timeStyle: "short" })}
				</time>
			</div>
			<span dir="ltr" className="min-w-0 truncate text-sm text-muted">
				{message.email}
			</span>
			{message.serviceTitle && (
				<Chip size="sm" variant="soft" className="justify-self-start">
					{message.serviceTitle}
				</Chip>
			)}
			<p className="text-sm wrap-anywhere whitespace-pre-wrap">{message.body}</p>
			<div className="flex flex-wrap gap-1">
				<a href={`mailto:${message.email}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
					<Icon name="envelope-simple" size={16} />
					<Trans>Reply by email</Trans>
				</a>
				<Button
					size="sm"
					variant="ghost"
					isDisabled={busy}
					onPress={() =>
						void run(
							() => client.portfolio.messages.markRead({ id: message.id, read: unread }),
							t`Couldn't change it. Try again.`,
						)
					}
				>
					{unread ? <Trans>Mark as read</Trans> : <Trans>Mark as unread</Trans>}
				</Button>
				<Button size="sm" variant="ghost" className="text-danger" isDisabled={busy} onPress={() => void remove()}>
					<Icon name="trash" size={16} />
					<Trans>Delete</Trans>
				</Button>
			</div>
		</li>
	);
}

/** Messages from the portfolio's contact form, newest first (`01-desain.md` section 9). Only its owner can read them. */
export function PortfolioMessages() {
	const titleId = useId();
	const messages = useInfiniteQuery(
		orpc.portfolio.messages.list.infiniteOptions({
			input: (cursor: string | undefined) => ({ cursor, limit: 20 }),
			initialPageParam: undefined,
			getNextPageParam: (page) => page.nextCursor ?? undefined,
		}),
	);
	const items = messages.data?.pages.flatMap((page) => page.items) ?? [];
	const unread = messages.data?.pages[0]?.unread ?? 0;

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading
				id={titleId}
				icon="envelope-simple"
				title={<Trans>Messages</Trans>}
				count={unread > 0 ? unread : undefined}
				description={<Trans>Sent through your contact form. Each one is deleted automatically after 90 days.</Trans>}
			/>
			<Widget.Content className="grid gap-3">
				{items.length === 0 ? (
					<p className="text-sm text-muted">
						<Trans>No messages yet. Turn on the contact form in the editor, under Contact.</Trans>
					</p>
				) : (
					<ul className="grid">
						{items.map((message) => (
							<MessageRow key={message.id} message={message} />
						))}
					</ul>
				)}
				{messages.hasNextPage && (
					<Button
						variant="secondary"
						size="sm"
						className="justify-self-start"
						isDisabled={messages.isFetchingNextPage}
						onPress={() => void messages.fetchNextPage()}
					>
						<Trans>Show older messages</Trans>
					</Button>
				)}
			</Widget.Content>
		</Widget>
	);
}
