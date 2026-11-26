import type { Portfolio } from "../queries";
import type { EditPortfolioOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import type { ChangeCall } from "@rezumi/portfolio/assistant";
import type { UIMessage } from "ai";
import { useLingui } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { callKey, callStatus } from "@rezumi/portfolio/assistant";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Field } from "./fields";
import { PicturePreview } from "./pictures";
import { useEditor } from "./store";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { useHasAIProvider } from "@/features/ai/providers";
import { refreshThreads, useThreads } from "@/features/assistant/chat";
import { ChatView } from "@/features/assistant/chat-view";
import { ModelSheet, ProviderGate, useConversationProvider } from "@/features/assistant/provider";
import { PastConversations } from "@/features/assistant/threads";
import { Button, Card, Sheet, Text, showToast } from "@/ui";

type PortfolioAssistantProps = { portfolio: Portfolio; workId: string | null; onBack: () => void };

export function PortfolioAssistant({ portfolio, workId, onBack }: PortfolioAssistantProps) {
	const { t } = useLingui();
	const { store, scope, assistant } = useEditor();
	const online = useOnline();
	const queryClient = useQueryClient();
	const providers = useHasAIProvider();
	const threads = useThreads();
	const [threadId, setThreadId] = useState<string | null>(null);
	const [history, setHistory] = useState(false);
	const [model, setModel] = useState(false);
	const [pictures, setPictures] = useState(false);
	const [imageUrl, setImageUrl] = useState("");
	const [adding, setAdding] = useState(false);
	const isMine = (thread: NonNullable<typeof threads.data>[number]) => thread.portfolioId === portfolio.id;
	const summary = threads.data?.find((thread) => thread.id === threadId && isMine(thread));
	const { provider, sourceNote, switching, choose, label } = useConversationProvider(providers, summary, threadId);
	const work = portfolio.data.works.items.find((item) => item.id === workId);
	const options = { context: { scope } };
	const mediaOptions = orpc.portfolio.aiView.queryOptions(options);
	const uploads = useQuery({
		...mediaOptions,
		queryKey: [...mediaOptions.queryKey, scope],
		enabled: pictures && online,
	});

	const applyIncoming = (messages: readonly UIMessage[], initial: readonly UIMessage[], id: string) => {
		const prior = new Set(
			initial.flatMap((message) =>
				message.parts.flatMap((part) =>
					"toolCallId" in part && "state" in part && part.state === "output-available" ? [part.toolCallId] : [],
				),
			),
		);
		assistant.autoApplyMessages(
			id,
			messages
				.filter((message) => message.role === "assistant")
				.map((message) => ({
					id: message.id,
					role: message.role,
					parts: message.parts.filter((part) => !("toolCallId" in part) || !prior.has(part.toolCallId)),
				})),
		);
	};
	const add = async () => {
		setAdding(true);
		try {
			await client.portfolio.addImage({ url: imageUrl.trim() }, options);
			setImageUrl("");
			await uploads.refetch();
			showToast({ title: t`Picture available to the assistant` });
		} catch {
			showToast({ title: t`Couldn't add the picture. Use a public JPEG, PNG or WebP link.`, variant: "danger" });
		} finally {
			setAdding(false);
		}
	};
	return (
		<View className="flex-1">
			<View className="gap-2 border-b border-border p-3">
				<View className="flex-row flex-wrap gap-2">
					<Button size="sm" variant="secondary" onPress={onBack}>{t`Back to editor`}</Button>
					<Button size="sm" variant="secondary" onPress={() => setHistory(true)}>{t`Conversations`}</Button>
					<Button size="sm" variant="secondary" onPress={() => setModel(true)}>
						{label}
					</Button>
					<Button
						size="sm"
						variant="secondary"
						isDisabled={!online}
						onPress={() => setPictures(true)}
					>{t`Pictures for AI`}</Button>
				</View>
				<Text tone="muted">{work?.title ? t`Focused on ${work.title}` : t`Context: entire portfolio`}</Text>
			</View>
			<ProviderGate
				providers={providers}
				threadsError={threads.error}
				loading={false}
				onRetry={() => {
					void threads.refetch();
					void providers.retry();
				}}
				notSetUp={t`Add a tested AI connection to use the portfolio assistant.`}
				readOnly={threadId !== null}
			>
				<ChatView
					threadId={threadId}
					createThread={async (requestedScope) =>
						(
							await client.agent.threads.start(
								{
									portfolioId: portfolio.id,
									...(provider ? { aiProviderId: provider.id } : {}),
								},
								{ context: { scope: requestedScope } },
							)
						).id
					}
					onThreadCreated={(id) => {
						setThreadId(id);
						refreshThreads(queryClient);
					}}
					context={{
						document: true,
						posting: false,
						web: false,
						work: Boolean(work),
						...(work ? { workId: work.id } : {}),
					}}
					document={null}
					flushDocument={() => store.getState().flush()}
					renderEffects={(message, id) =>
						message.parts.map((part) => {
							const result = assistant.editCallOf(id, message.id, part);
							return result ? <EditCard key={callKey(result.call)} {...result} /> : null;
						})
					}
					onMessages={applyIncoming}
					privacy={t`Your portfolio, request and conversation go to this AI connection. Edits are applied to your draft and can be undone.`}
					placeholder={t`Ask for a portfolio change…`}
					assistantName={t`Portfolio assistant`}
					sourceNote={sourceNote}
					disabled={!online || !provider || switching}
					onSwitchModel={() => setModel(true)}
					onFinish={() => {
						void queryClient.invalidateQueries({ queryKey: orpc.billing.summary.key() });
					}}
				/>
			</ProviderGate>
			<Sheet isOpen={history} onOpenChange={setHistory} title={t`Portfolio conversations`} closeLabel={t`Close`}>
				<Button
					onPress={() => {
						setThreadId(null);
						setHistory(false);
					}}
				>{t`New conversation`}</Button>
				<PastConversations
					threads={(threads.data ?? []).filter(isMine)}
					currentId={threadId}
					onOpen={(thread) => {
						setThreadId(thread.id);
						setHistory(false);
					}}
					onDeleted={(id) => {
						if (threadId === id) setThreadId(null);
					}}
				/>
			</Sheet>
			<ModelSheet
				open={model}
				onClose={() => setModel(false)}
				providers={providers.usableProviders}
				currentId={provider?.id}
				onChoose={(id) => void choose(id)}
			/>
			<Sheet isOpen={pictures} onOpenChange={setPictures} title={t`Pictures for AI`} closeLabel={t`Close`}>
				<View className="gap-3">
					<Text>{t`Save a picture from a public URL so the assistant can place it in your portfolio.`}</Text>
					<Field
						label={t`Picture URL`}
						value={imageUrl}
						onChange={setImageUrl}
						max={PORTFOLIO_LIMITS.text.url}
						keyboard="url"
					/>
					<Button
						isDisabled={!online || adding || !imageUrl.trim()}
						onPress={() => void add()}
					>{t`Add picture`}</Button>
					{uploads.data?.uploads.map((picture) => (
						<PicturePreview key={picture.key} picture={picture} />
					))}
				</View>
			</Sheet>
		</View>
	);
}

type EditCardProps = { call: ChangeCall; output: EditPortfolioOutput };

function EditCard({ call, output }: EditCardProps) {
	const { t } = useLingui();
	const { assistant, store } = useEditor();
	const record = assistant.usePortfolioChanges((state) => state.calls[callKey(call)]);
	const status = callStatus(record, output.edits);
	const apply = () => assistant.applyCall(call, output.edits);
	const undo = () => assistant.undoCall(call);
	return (
		<Card className="gap-2">
			<Text weight="semibold">{output.title || t`Portfolio edits`}</Text>
			{output.edits.map((edit) => (
				<Text key={edit.id}>{edit.summary}</Text>
			))}
			{output.failed.map((entry) => (
				<Text key={entry.index} tone="danger">
					{entry.error}
				</Text>
			))}
			{record?.failed.map((error, index) => (
				<Text key={index} tone="danger">
					{error}
				</Text>
			))}
			<View className="flex-row flex-wrap gap-2">
				{status.kind === "applied" ? <Text tone="muted">{t`Applied to draft`}</Text> : null}
				{status.kind === "applied" && status.canUndo ? (
					<Button size="sm" variant="secondary" onPress={undo}>{t`Undo`}</Button>
				) : null}
				{status.kind === "pending" || status.kind === "undone" ? (
					<Button
						size="sm"
						variant="secondary"
						onPress={() => {
							if (store.getState().portfolio) apply();
						}}
					>
						{status.kind === "pending" ? t`Apply edits` : t`Redo`}
					</Button>
				) : null}
			</View>
		</Card>
	);
}
