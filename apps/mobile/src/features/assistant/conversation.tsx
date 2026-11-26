import type { ChatViewProps } from "./chat-view";
import type { ConversationProps } from "./use-conversation";
import type { LegendListRef } from "@legendapp/list/react-native";
import { LegendList } from "@legendapp/list/react-native";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AccessibilityInfo, RefreshControl, View } from "react-native";
import { isProposeEdits } from "@rezumi/ai/assistant-proposals";
import { textOf, transcriptOf } from "./chat";
import { Composer } from "./composer";
import { errorText } from "./errors";
import { MessageView, Status } from "./messages";
import { ToolApprovals } from "./tool-approvals";
import { useConversation } from "./use-conversation";
import { Alert, Button, Icon, Text, showToast, space, usePullRefresh, useThemeColor } from "@/ui";
import { ChatFrame } from "@/ui/keyboard";

type EmptyProps = { render: ChatViewProps["empty"]; send: (text: string) => void };

export function Empty({ render, send }: EmptyProps) {
	return render?.(send) ?? null;
}

const messagePadding = { padding: space[4] };

export function Conversation(props: ConversationProps) {
	const { t } = useLingui();
	const {
		messages,
		status,
		error,
		stopped,
		streaming,
		readOnly,
		continuationBlocked,
		handlers,
		answer,
		send,
		stopReply,
		retry,
		decide,
	} = useConversation(props);
	const effectMessages = useEffectEvent((updated: typeof messages) =>
		props.onMessages?.(updated, props.initialMessages, props.threadId),
	);
	useEffect(() => {
		effectMessages(messages);
	}, [messages]);

	const pull = usePullRefresh(...(props.onRefresh ? [props.onRefresh] : []));
	const accent = useThemeColor("accent");
	const list = useRef<LegendListRef>(null);
	const [behind, setBehind] = useState(false);
	const last = messages.at(-1);
	const proposedInLast = last?.role === "assistant" && last.parts.some(isProposeEdits);

	// Announce a new reply once, after streaming, and leave focus where the person was reading or typing.
	const announced = useRef(props.initialMessages.at(-1)?.id);
	useEffect(() => {
		if (streaming || last?.role !== "assistant" || last.id === announced.current) return;
		const reply = textOf(last);
		if (!reply && !proposedInLast) return;
		announced.current = last.id;
		AccessibilityInfo.announceForAccessibility(reply || t`New suggested edits`);
	}, [last, streaming, proposedInLast, t]);

	const copyTranscript = async () => {
		try {
			await Clipboard.setStringAsync(
				transcriptOf(messages, { user: t`You`, assistant: props.assistantName, sources: t`Sources` }),
			);
			showToast({ title: t`Transcript copied` });
		} catch {
			showToast({ title: t`Couldn't copy the transcript. Try again.` });
		}
	};

	return (
		<ChatFrame>
			<View className="flex-1">
				<LegendList
					ref={list}
					onScroll={(event) => {
						const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
						setBehind(contentSize.height - layoutMeasurement.height - contentOffset.y > space[8]);
					}}
					scrollEventThrottle={64}
					data={messages}
					keyExtractor={(message) => message.id}
					extraData={{ streaming, readOnly, handlers, answer, continuationBlocked }}
					initialScrollAtEnd
					maintainScrollAtEnd={{ animated: false }}
					maintainVisibleContentPosition
					maintainScrollAtEndThreshold={0.2}
					recycleItems={false}
					alwaysBounceVertical
					refreshControl={
						props.onRefresh ? <RefreshControl {...pull} tintColor={accent} colors={[accent]} /> : undefined
					}
					accessibilityLabel={t`Conversation`}
					contentContainerStyle={messagePadding}
					ItemSeparatorComponent={MessageGap}
					keyboardDismissMode="interactive"
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={!streaming ? <Empty render={props.empty} send={(text) => void send(text)} /> : null}
					renderItem={({ item: message, index }) => {
						const latest = index === messages.length - 1;
						return (
							<View className="gap-3">
								<MessageView
									message={message}
									streaming={streaming && latest}
									readOnly={readOnly}
									proposals={handlers}
									onAnswer={!latest || streaming ? null : answer}
								/>
								{props.renderEffects?.(message, props.threadId)}
								<ToolApprovals
									message={message}
									disabled={readOnly || streaming || !latest || continuationBlocked}
									onDecision={decide}
								/>
							</View>
						);
					}}
					ListFooterComponent={
						<View className="gap-3 pt-3">
							{status === "submitted" ? (
								<Status status="running">
									<Trans>Thinking…</Trans>
								</Status>
							) : null}
							{stopped && !streaming && !proposedInLast ? (
								<View className="flex-row flex-wrap items-center gap-2">
									<Icon name="stop-circle" tone="muted" />
									<Text tone="muted">
										{props.document ? <Trans>Stopped. No edits were proposed.</Trans> : <Trans>Stopped</Trans>}
									</Text>
									<Button size="sm" variant="tertiary" isDisabled={readOnly} onPress={() => send(t`Continue`)}>
										<Button.Label>
											<Trans>Continue</Trans>
										</Button.Label>
									</Button>
								</View>
							) : null}
							{error && !streaming ? (
								<Alert status="danger">
									<Alert.Indicator />
									<Alert.Content>
										<Alert.Title>{errorText(error, t`The reply was interrupted.`)}</Alert.Title>
										<Alert.Description>
											{continuationBlocked
												? t`Context is left out, so reply with a new message instead.`
												: t`Your message is kept. Try again to continue.`}
										</Alert.Description>
										<View className="mt-2 flex-row flex-wrap gap-1">
											<Button
												size="sm"
												variant="secondary"
												isDisabled={readOnly || continuationBlocked}
												onPress={retry}
											>
												<Button.Label>
													<Trans>Retry</Trans>
												</Button.Label>
											</Button>
											{props.onSwitchModel ? (
												<Button size="sm" variant="ghost" onPress={props.onSwitchModel}>
													<Button.Label>
														<Trans>Switch model</Trans>
													</Button.Label>
												</Button>
											) : null}
										</View>
									</Alert.Content>
								</Alert>
							) : null}
							{!streaming && messages.length > 0 ? (
								<Button size="sm" variant="ghost" className="self-start" onPress={copyTranscript}>
									<Icon name="copy" size={16} />
									<Button.Label>
										<Trans>Copy transcript</Trans>
									</Button.Label>
								</Button>
							) : null}
						</View>
					}
				/>
				{behind ? (
					<View pointerEvents="box-none" className="absolute inset-x-0 bottom-3 items-center">
						<Button size="sm" variant="secondary" onPress={() => void list.current?.scrollToEnd({ animated: true })}>
							<Icon name="arrow-down" size={16} />
							<Button.Label>
								<Trans>Latest</Trans>
							</Button.Label>
						</Button>
					</View>
				) : null}
			</View>
			<Composer
				{...props}
				streaming={streaming}
				disabled={readOnly}
				ensureThread={() => Promise.resolve(props.threadId)}
				onSend={send}
				onStop={stopReply}
			/>
		</ChatFrame>
	);
}

function MessageGap() {
	return <View className="h-4" />;
}
