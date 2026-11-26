import type { ThreadSummary } from "./chat";
import type { useHasAIProvider } from "@/features/ai/providers";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { CREDIT_COSTS } from "@rezumi/schema/billing";
import { useConversationConnection } from "./chat";
import { client, orpc } from "@/api/client";
import { getAccountScope } from "@/auth/session";
import { AIProviderSetupSheet } from "@/features/ai/providers";
import { routes } from "@/routes";
import { Button, EmptyState, Icon, ListGroup, ListRow, Sheet, Spinner, showToast } from "@/ui";

type Providers = ReturnType<typeof useHasAIProvider>;
export type UsableProvider = Providers["usableProviders"][number];

/** Keep sends paused until the server confirms a change to the conversation's connection. */
export function useConversationProvider(
	providers: Providers,
	summary: ThreadSummary | undefined,
	threadId: string | null,
) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [picked, setPicked] = useState<string | null>(null);
	const [switching, setSwitching] = useState(false);
	const usable = providers.usableProviders;
	const provider = usable.find((item) => item.id === (threadId ? summary?.aiProviderId : picked)) ?? usable[0];
	useConversationConnection(threadId ? summary : undefined, switching ? undefined : provider);
	const sourceNote = provider
		? provider.managed
			? providers.choice
				? t`Rezumi AI · ${CREDIT_COSTS["coach-turn"]} credit per reply · ${providers.balance} left`
				: provider.label
			: t`Your AI connection · ${provider.label}`
		: undefined;

	const scope = getAccountScope();
	const choose = async (id: string) => {
		setPicked(id);
		if (!threadId || !scope || switching) return;
		setSwitching(true);
		try {
			await client.agent.threads.update({ id: threadId, aiProviderId: id }, { context: { scope } });
			await queryClient.invalidateQueries({ queryKey: orpc.agent.threads.list.key() });
		} catch {
			showToast({ title: t`Couldn't switch models. Try again.` });
		} finally {
			setSwitching(false);
		}
	};

	return {
		provider,
		label: provider?.label ?? summary?.providerLabel ?? t`your provider`,
		sourceNote,
		switching,
		choose,
	};
}

type ModelSheetProps = {
	open: boolean;
	onClose: () => void;
	providers: readonly UsableProvider[];
	currentId: string | undefined;
	onChoose: (id: string) => void;
};

export function ModelSheet({ open, onClose, providers, currentId, onChoose }: ModelSheetProps) {
	const router = useRouter();
	const { t } = useLingui();
	const [settings, setSettings] = useState(false);
	return (
		<Sheet
			isOpen={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t`Model`}
			closeLabel={t`Close`}
			onDidDismiss={() => {
				if (!settings) return;
				setSettings(false);
				router.push(routes.account("ai-providers"));
			}}
		>
			<ListGroup>
				{providers.map((item) => (
					<ListRow
						key={item.id}
						title={item.label}
						description={item.model}
						isSelected={item.id === currentId}
						onPress={() => {
							onChoose(item.id);
							onClose();
						}}
					/>
				))}
				<ListRow
					title={t`AI settings`}
					icon="gear-six"
					onPress={() => {
						setSettings(true);
						onClose();
					}}
				/>
			</ListGroup>
		</Sheet>
	);
}

export function ModelButton({ label, onPress }: { label: string; onPress: () => void }) {
	const { t } = useLingui();
	return (
		<Button
			size="sm"
			variant="tertiary"
			className="self-start"
			accessibilityLabel={t`Model: ${label}`}
			onPress={onPress}
		>
			<Button.Label numberOfLines={1}>{label}</Button.Label>
			<Icon name="caret-down" size={16} tone="muted" />
		</Button>
	);
}

type ProviderGateProps = {
	providers: Providers;
	threadsError: unknown;
	loading: boolean;
	onRetry: () => void;
	notSetUp: string;
	readOnly?: boolean;
	children: ReactNode;
};

export function ProviderGate({
	providers,
	threadsError,
	loading,
	onRetry,
	notSetUp,
	readOnly = false,
	children,
}: ProviderGateProps) {
	const router = useRouter();
	const { t } = useLingui();
	const [setupOpen, setSetupOpen] = useState(false);
	if (threadsError instanceof ORPCError && threadsError.code === "PRECONDITION_FAILED")
		return <EmptyState kind="page" icon="warning-circle" title={t`AI is unavailable`} description={notSetUp} />;
	if (providers.error && !readOnly)
		return (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`AI connections couldn't load.`}
				action={{ label: t`Retry`, onPress: onRetry }}
			/>
		);
	if ((providers.isLoading && !readOnly) || loading)
		return (
			<View className="flex-1 items-center justify-center">
				<Spinner />
			</View>
		);
	if (providers.hasAIProvider || readOnly) return children;
	return (
		<>
			<EmptyState
				kind="page"
				icon="sparkle"
				title={t`Connect an AI provider`}
				description={t`Add your own connection to start a conversation.`}
				action={{ label: t`Connect`, onPress: () => setSetupOpen(true) }}
				secondaryAction={{ label: t`Open AI settings`, onPress: () => router.push(routes.account("ai-providers")) }}
			/>
			<AIProviderSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} onReady={onRetry} />
		</>
	);
}
