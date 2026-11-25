import type { ThreadSummary } from "./chat";
import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { refreshThreads } from "./chat";
import { client } from "@/api/client";
import { getAccountScope } from "@/auth/session";
import { Button, ConfirmDialog, Input, ListGroup, ListRow, Text, showToast } from "@/ui";
import { SheetMenu } from "@/ui/sheet-menu";

export const useThreadTitle = () => {
	const { t } = useLingui();
	return (thread: ThreadSummary | undefined) =>
		thread && thread.title !== "New conversation" ? thread.title : t`New conversation`;
};

export function useThreadTime() {
	const { i18n } = useLingui();
	const format = new Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "short" });
	return (value: Date | string) => format.format(new Date(value));
}

export function useDeleteThread(onDeleted?: (id: string) => void) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const scope = getAccountScope();
	const [target, setTarget] = useState<ThreadSummary | null>(null);
	const dialog = (
		<ConfirmDialog
			isOpen={target !== null}
			onOpenChange={(open) => {
				if (!open) setTarget(null);
			}}
			title={t`Delete this conversation?`}
			message={t`Its messages and attachments are deleted. Edits you accepted stay in the document.`}
			confirmLabel={t`Delete conversation`}
			cancelLabel={t`Keep conversation`}
			destructive
			onConfirm={() => {
				if (!target || !scope) return;
				void client.agent.threads
					.delete({ id: target.id }, { context: { scope } })
					.then(() => {
						refreshThreads(queryClient);
						onDeleted?.(target.id);
					})
					.catch(() => showToast({ title: t`Couldn't delete the conversation. Try again.` }));
			}}
		/>
	);
	return { ask: setTarget, dialog };
}

type PastConversationsProps = {
	threads: readonly ThreadSummary[];
	isMine?: (thread: ThreadSummary) => boolean;
	currentId: string | null;
	onOpen: (thread: ThreadSummary) => void;
	onDeleted: (id: string) => void;
};

export function PastConversations({ threads, isMine, currentId, onOpen, onDeleted }: PastConversationsProps) {
	const { t } = useLingui();
	const title = useThreadTitle();
	const time = useThreadTime();
	const queryClient = useQueryClient();
	const remove = useDeleteThread(onDeleted);
	const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
	const mine = isMine ? threads.filter(isMine) : threads;
	const others = isMine
		? threads.filter((thread) => !isMine(thread) && (thread.workingResumeId || thread.coverLetterId))
		: [];

	const saveName = async () => {
		const scope = getAccountScope();
		const target = renaming;
		const name = target?.title.trim();
		if (!scope || !target || !name) return;
		try {
			await client.agent.threads.update({ id: target.id, title: name }, { context: { scope } });
			refreshThreads(queryClient);
			setRenaming(null);
		} catch {
			showToast({ title: t`Couldn't rename the conversation. Try again.` });
		}
	};
	const row = (thread: ThreadSummary, other = false) => {
		const outcome = thread.editsProposed
			? plural(thread.editsProposed, {
					one: `${thread.editsAccepted} of # edit accepted`,
					other: `${thread.editsAccepted} of # edits accepted`,
				})
			: "";
		return renaming?.id === thread.id ? (
			<View key={thread.id} className="gap-2 p-3">
				<Input
					variant="secondary"
					accessibilityLabel={t`Conversation name`}
					value={renaming.title}
					maxLength={200}
					onChangeText={(name) => setRenaming({ id: thread.id, title: name })}
					onSubmitEditing={() => void saveName()}
				/>
				<View className="flex-row gap-2">
					<Button size="sm" onPress={() => void saveName()}>
						<Button.Label>
							<Trans>Save</Trans>
						</Button.Label>
					</Button>
					<Button size="sm" variant="ghost" onPress={() => setRenaming(null)}>
						<Button.Label>
							<Trans>Cancel</Trans>
						</Button.Label>
					</Button>
				</View>
			</View>
		) : (
			<View key={thread.id} className="flex-row items-center gap-1 pe-2">
				<View className="flex-1">
					<ListRow
						title={title(thread)}
						description={[
							time(thread.lastMessageAt),
							outcome,
							other ? (thread.coverLetterName ?? thread.resumeName) : "",
						]
							.filter(Boolean)
							.join(" · ")}
						isSelected={thread.id === currentId}
						onPress={() => onOpen(thread)}
					/>
				</View>
				<ThreadMenu
					label={title(thread)}
					onRename={() => setRenaming({ id: thread.id, title: title(thread) })}
					onDelete={() => remove.ask(thread)}
				/>
			</View>
		);
	};

	return (
		<ScrollView className="flex-1" contentContainerClassName="gap-3 p-4" keyboardShouldPersistTaps="handled">
			{isMine ? (
				<Text size="xs" weight="semibold" tone="muted">
					<Trans>This document</Trans>
				</Text>
			) : null}
			{mine.length ? (
				<ListGroup>{mine.map((thread) => row(thread))}</ListGroup>
			) : (
				<Text tone="muted">
					<Trans>No conversations yet.</Trans>
				</Text>
			)}
			{others.length ? (
				<>
					<Text size="xs" weight="semibold" tone="muted">{t`Other documents · ${others.length}`}</Text>
					<ListGroup>{others.map((thread) => row(thread, true))}</ListGroup>
				</>
			) : null}
			{remove.dialog}
		</ScrollView>
	);
}

type ThreadMenuProps = { label: string; onRename: () => void; onDelete: () => void };

function ThreadMenu({ label, onRename, onDelete }: ThreadMenuProps) {
	const { t } = useLingui();
	return (
		<SheetMenu
			label={t`Options for ${label}`}
			closeLabel={t`Close`}
			items={[
				{ label: t`Rename`, onPress: onRename },
				{ label: t`Delete conversation`, onPress: onDelete, destructive: true },
			]}
		/>
	);
}
