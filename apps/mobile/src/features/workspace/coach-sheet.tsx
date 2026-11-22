// Ask coach from the workspace: the application's own conversations in a sheet, knowing which part is open. The chat
// itself is the assistant's (Phase 11 rebuilds it); this frame is on the design system.
import type { Application } from "@/features/applications/types";
import type { MessageContext } from "@/features/assistant/chat";
import type { WorkspaceTab } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Notice } from "./blocks";
import { partLabel } from "./working";
import { client } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/providers";
import { useThreads } from "@/features/assistant/chat";
import { ChatView } from "@/features/assistant/chat-view";
import { ModelButton, ModelSheet, ProviderGate, useConversationProvider } from "@/features/assistant/provider";
import { useDeleteThread, useThreadTime, useThreadTitle } from "@/features/assistant/threads";
import { IconButton, ListGroup, ListRow, Sheet, Text, Typography } from "@/ui";

type CoachSheetProps = {
	application: Application;
	tab: WorkspaceTab;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
};

/** Mounted only while open: leaving detaches the stream and discards unsent attachments. Reopening reads history. */
export function CoachSheet({ application, tab, isOpen, onOpenChange }: CoachSheetProps) {
	const { t } = useLingui();
	useSession();
	const scope = getAccountScope();
	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Coach`}
			closeLabel={t`Close`}
			detents={[0.9]}
			scroll={false}
			padded={false}
		>
			{isOpen && scope ? (
				<ApplicationCoach key={`${scope}:${application.id}`} application={application} tab={tab} />
			) : null}
		</Sheet>
	);
}

type ApplicationCoachProps = { application: Application; tab: WorkspaceTab };

function ApplicationCoach({ application, tab }: ApplicationCoachProps) {
	const { t } = useLingui();
	const { height } = useWindowDimensions();
	const providers = useHasAIProvider();
	const threads = useThreads();
	const [selected, setSelected] = useState<string | null>(null);
	const [draftKey, setDraftKey] = useState(0);
	const [history, setHistory] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const list = (threads.data ?? []).filter(
		(thread) => thread.scope === "application" && thread.applicationId === application.id,
	);
	const threadId = selected === "new" ? null : (selected ?? list[0]?.id ?? null);
	const summary = list.find((thread) => thread.id === threadId);
	const { provider, label, choose } = useConversationProvider(providers, summary, threadId);
	const title = useThreadTitle();
	const time = useThreadTime();
	const open = (id: string) => {
		setDraftKey((key) => key + 1);
		setSelected(id);
		setHistory(false);
	};
	const remove = useDeleteThread((id) => {
		if (id === threadId) open("new");
	});
	const context: MessageContext = { document: true, posting: true, application: true, memory: true, web: false, tab };
	const company = application.company;
	const part = partLabel(tab);
	// The chat fills most of the sheet; measured at run time from the window.
	const frame = { height: height * 0.75 };
	const privacy = t`Sends your message, earlier messages, this application (posting, notes, documents sent) and your Profile, if switched on, to ${label}.`;

	return (
		<View style={frame}>
			<View className="flex-row items-center gap-2 px-4 py-2">
				<View className="flex-1">
					<Text size="xs" tone="muted">{t`${company} · ${part}`}</Text>
					<ModelButton label={provider?.model ?? label} onPress={() => setModelOpen(true)} />
				</View>
				<IconButton
					icon="clock-counter-clockwise"
					label={t`Conversations`}
					isSelected={history}
					onPress={() => setHistory(!history)}
				/>
				<IconButton icon="note-pencil" label={t`New conversation`} onPress={() => open("new")} />
			</View>
			<ProviderGate
				providers={providers}
				readOnly={history || threadId !== null}
				threadsError={threads.error}
				loading={threads.isPending}
				onRetry={() => {
					providers.retry();
					void threads.refetch();
				}}
				notSetUp={t`The coach isn't set up on this server. Whoever runs it needs to set ENCRYPTION_SECRET.`}
			>
				{threads.isError ? (
					<View className="px-4">
						<Notice
							status="danger"
							message={t`Conversations couldn't load.`}
							action={{ label: t`Retry`, onPress: () => void threads.refetch() }}
						/>
					</View>
				) : history ? (
					<ListGroup className="mx-4">
						<ListRow title={t`New conversation`} icon="note-pencil" onPress={() => open("new")} />
						{list.map((thread) => (
							<ListRow
								key={thread.id}
								title={title(thread)}
								description={time(thread.lastMessageAt)}
								isSelected={thread.id === threadId}
								onPress={() => open(thread.id)}
								trailing={
									<IconButton icon="trash" label={t`Delete ${title(thread)}`} onPress={() => remove.ask(thread)} />
								}
							/>
						))}
					</ListGroup>
				) : (
					<ChatView
						key={draftKey}
						threadId={threadId}
						createThread={async (scope) =>
							(
								await client.agent.threads.start(
									{
										scope: "application",
										applicationId: application.id,
										...(provider ? { aiProviderId: provider.id } : {}),
									},
									{ context: { scope } },
								)
							).id
						}
						onThreadCreated={(id) => {
							setSelected(id);
							void threads.refetch();
						}}
						context={context}
						document={null}
						disabled={!providers.hasAIProvider}
						connection={label}
						privacy={privacy}
						placeholder={t`Ask about this application…`}
						assistantName={t`Coach`}
						onSwitchModel={() => setModelOpen(true)}
						empty={() => (
							<Typography type="body-sm" color="muted">
								{t`Ask anything about this job. The coach reads the posting, your notes and what you sent, and knows you're on ${part}.`}
							</Typography>
						)}
					/>
				)}
			</ProviderGate>
			<ModelSheet
				open={modelOpen}
				onClose={() => setModelOpen(false)}
				providers={providers.usableProviders}
				currentId={provider?.id}
				onChoose={(id) => void choose(id)}
			/>
			{remove.dialog}
		</View>
	);
}
