import type { SavedProvider } from "./catalog";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { View } from "react-native";
import { keyEnding, providerLabel } from "./catalog";
import { aiSettingsError } from "./error";
import { ProviderEditorSheet } from "./provider-editor";
import { AIProviderSetupSheet, useHasAIProvider } from "./providers";
import { client, orpc } from "@/api/client";
import { creditCount } from "@/features/billing/credits";
import { Button, Card, EmptyState, Skeleton, Text, Icon } from "@/ui";

export function ProviderList() {
	const { t } = useLingui();
	const state = useHasAIProvider();
	const [adding, setAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const editing = state.providers.find((provider) => provider.id === editingId);
	if (state.error)
		return (
			<>
				<EmptyState
					kind="inline"
					icon="warning-circle"
					title={
						state.error instanceof ORPCError && state.error.code === "PRECONDITION_FAILED"
							? t`AI providers aren't available on this server until ENCRYPTION_SECRET is set.`
							: t`AI providers couldn't be loaded. Reload to try again.`
					}
				/>
				<Button onPress={state.retry}>{t`Try again`}</Button>
			</>
		);
	if (state.isUnavailable)
		return (
			<>
				<Text>{t`Loading providers…`}</Text>
				<Skeleton variant="none" className="h-12 rounded-xl" />
				<Skeleton variant="none" className="h-12 rounded-xl" />
			</>
		);
	// The server's AI as the only one, as before plans existed; while the account chooses it's Rezumi AI in the list.
	const managed = !state.choice && state.providers.some((provider) => provider.managed);
	return (
		<>
			{state.providers.length === 0 && (
				<EmptyState
					kind="page"
					icon="sparkle"
					title={t`No AI provider yet`}
					description={t`Word import, Improve, the assistant, letter drafts, Career coaching and generation, and voice practice need one. Editing, Design, the readability checks and downloads work without one.`}
				/>
			)}
			{state.providers.map((provider) => (
				<ProviderRow
					key={provider.id}
					provider={provider}
					balance={state.choice && provider.managed ? state.balance : null}
					isDefault={state.defaultProvider?.id === provider.id}
					onEdit={() => setEditingId(provider.id)}
				/>
			))}
			{!managed && (
				<Button variant="secondary" onPress={() => setAdding(true)}>
					<Icon name="plus" />
					<Button.Label>{t`Add AI provider`}</Button.Label>
				</Button>
			)}
			<AIProviderSetupSheet open={adding} onClose={() => setAdding(false)} />
			{editing && !editing.managed && (
				<ProviderEditorSheet open provider={editing} onClose={() => setEditingId(null)} />
			)}
		</>
	);
}

type ProviderRowProps = {
	provider: SavedProvider;
	/** Rezumi AI's spendable credits (Android only); null for the user's own connections. */
	balance: number | null;
	isDefault: boolean;
	onEdit: () => void;
};

function ProviderRow({ provider, balance, isDefault, onEdit }: ProviderRowProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const busy = useRef(false);
	const [pending, setPending] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const testError = failure ?? (result ? null : provider.testStatus === "failure" ? provider.testError : null);
	const run = async (action: "test" | "default") => {
		if (busy.current) return;
		busy.current = true;
		setPending(true);
		setFailure(null);
		setResult(null);
		const start = performance.now();
		try {
			if (action === "default") await client.aiProviders.setDefault({ id: provider.id });
			else {
				const tested = await client.aiProviders.test({ id: provider.id });
				const milliseconds = Math.round(performance.now() - start);
				if (tested.testStatus === "success") setResult(t`Connected · ${milliseconds} ms`);
				else setFailure(tested.testError || t`The provider didn't answer. Check the key, the model and the base URL.`);
			}
		} catch (error) {
			setFailure(aiSettingsError(error, action === "test"));
		} finally {
			void queryClient.invalidateQueries({ queryKey: orpc.aiProviders.list.key() });
			busy.current = false;
			setPending(false);
		}
	};
	return (
		<Card className="gap-2">
			<Text weight="semibold">{provider.label}</Text>
			<Text tone="muted">{providerLabel(provider.provider)}</Text>
			<Text size="sm" selectable>
				{provider.model}
			</Text>
			{provider.apiKeyPreview && (
				<Text mono tone="muted">
					{keyEnding(provider.apiKeyPreview)}
				</Text>
			)}
			<Text tone={provider.enabled && provider.testStatus === "success" ? "accent" : "muted"}>
				{provider.testStatus === "failure"
					? t`Needs attention`
					: provider.enabled && provider.testStatus === "success"
						? t`Ready`
						: t`Off`}
			</Text>
			{isDefault && <Text size="xs" tone="accent">{t`Default`}</Text>}
			{balance !== null ? (
				<>
					<Text tone="muted">
						{t`No API key needed. Each action asks before using credits · ${creditCount(balance)} left`}
					</Text>
					{!isDefault && (
						<Button variant="ghost" isDisabled={pending} onPress={() => void run("default")}>{t`Make default`}</Button>
					)}
					{failure && (
						<Text accessibilityRole="alert" tone="danger">
							{t`Failed`} · {failure}
						</Text>
					)}
				</>
			) : provider.managed ? (
				<Text tone="muted">{t`Managed by your server`}</Text>
			) : (
				<>
					<View className="flex-row flex-wrap gap-2">
						<Button variant="secondary" isDisabled={pending} onPress={() => void run("test")}>
							{pending ? t`Testing…` : t`Test`}
						</Button>
						<Button variant="ghost" isDisabled={pending} onPress={onEdit}>{t`Edit`}</Button>
						{!isDefault && provider.enabled && provider.testStatus === "success" && (
							<Button
								variant="ghost"
								isDisabled={pending}
								onPress={() => void run("default")}
							>{t`Make default`}</Button>
						)}
					</View>
					{result && (
						<Text accessibilityLiveRegion="polite" tone="accent">
							{result}
						</Text>
					)}
					{testError && (
						<Text accessibilityRole="alert" tone="danger">
							{t`Failed`} · {testError}
						</Text>
					)}
				</>
			)}
		</Card>
	);
}
