// Improve (`ai.improve`, the web's improve.tsx): pick what to change, then Replace or Keep mine. Only the one line
// changes, and only when the person replaces it; a line edited meanwhile isn't replaced. Without a provider, the setup
// sheet connects one first. Consent for each AI request is asked by the transport (`src/api/ai-consent.ts`).
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { orpc } from "@/api/client";
import { AIProviderSetupSheet, useHasAIProvider } from "@/features/ai/providers";
import { Button, Icon, Input, Label, Spinner, Surface, Text, TextField } from "@/ui";

type Action = "verb" | "result" | "shorter" | "custom";

export type ImprovePanelProps = {
	line: { index: number; text: string };
	/** Where the line sits: the field's label. */
	where: string;
	/** The rest of the field, so a result can come from the lines around it. */
	context: string;
	onClose: () => void;
	/** Swaps the line; false when it changed since Improve was asked. */
	onReplace: (text: string) => Promise<boolean>;
};

export function ImprovePanel({ line, where, context, onClose, onReplace }: ImprovePanelProps) {
	const { t } = useLingui();
	const ai = useHasAIProvider();
	const [asking, setAsking] = useState(false);
	const [request, setRequest] = useState("");
	const [changed, setChanged] = useState(false);
	const [setup, setSetup] = useState(false);
	const improve = useMutation(orpc.ai.improve.mutationOptions());

	const options: { action: Action; icon: IconName; label: string }[] = [
		{ action: "verb", icon: "lightning", label: t`Stronger verb` },
		{ action: "result", icon: "trend-up", label: t`Add a result` },
		{ action: "shorter", icon: "arrows-in-line-vertical", label: t`Make it shorter` },
	];

	const run = (action: Action) =>
		improve.mutate({
			action,
			line: line.text,
			where,
			context: context.slice(0, 10_000),
			...(action === "custom" ? { request: request.trim() } : {}),
		});

	const error =
		improve.error instanceof ORPCError && improve.error.message
			? improve.error.message
			: t`Couldn't get a suggestion. Nothing changed.`;

	const body = () => {
		if (ai.isLoading) return <Spinner size="sm" />;
		if (!ai.hasAIProvider)
			return (
				<View className="gap-2">
					<Text size="xs" tone="muted">
						{ai.error ? t`AI providers couldn't be loaded.` : t`Improve needs an AI provider. Connect one to continue.`}
					</Text>
					<View className="flex-row gap-2">
						{ai.error ? (
							<Button size="sm" variant="secondary" onPress={ai.retry}>{t`Try again`}</Button>
						) : (
							<Button size="sm" onPress={() => setSetup(true)}>{t`Set up a provider`}</Button>
						)}
						<Button size="sm" variant="ghost" onPress={onClose}>{t`Cancel`}</Button>
					</View>
				</View>
			);
		if (improve.data)
			return (
				<View className="gap-2 rounded-xl bg-background p-3">
					<Text accessibilityLiveRegion="polite" className="self-start rounded bg-accent-soft px-1">
						{improve.data.text}
					</Text>
					<Text size="xs" tone="muted">
						{improve.data.why}
						{improve.data.addsFacts ? ` ${t`Check it's accurate.`}` : ""}
					</Text>
					{changed ? (
						<Text size="xs" tone="danger" accessibilityLiveRegion="assertive">
							{t`The line changed since you asked, so it wasn't replaced.`}
						</Text>
					) : null}
					<View className="flex-row gap-2">
						{!changed ? (
							<Button
								size="sm"
								onPress={() => void onReplace(improve.data.text).then((done) => setChanged(!done))}
								testID="improve-replace"
							>
								{t`Replace`}
							</Button>
						) : null}
						<Button size="sm" variant="secondary" onPress={onClose}>{t`Keep mine`}</Button>
					</View>
				</View>
			);
		if (improve.isPending)
			return (
				<View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
					<Spinner size="sm" />
					<Text tone="muted">{t`Improving…`}</Text>
				</View>
			);
		if (improve.isError)
			return (
				<View className="gap-2">
					<Text size="xs" tone="danger" accessibilityLiveRegion="assertive">
						{error}
					</Text>
					<View className="flex-row gap-2">
						<Button size="sm" variant="secondary" onPress={() => improve.reset()}>{t`Try again`}</Button>
						<Button size="sm" variant="ghost" onPress={onClose}>{t`Cancel`}</Button>
					</View>
				</View>
			);
		if (asking)
			return (
				<View className="gap-2">
					<TextField>
						<Label>{t`What should change?`}</Label>
						<Input
							variant="secondary"
							accessibilityLabel={t`What should change?`}
							value={request}
							maxLength={500}
							autoFocus
							returnKeyType="send"
							onChangeText={setRequest}
							onSubmitEditing={() => request.trim() && run("custom")}
						/>
					</TextField>
					<View className="flex-row gap-2">
						<Button size="sm" isDisabled={!request.trim()} onPress={() => run("custom")}>{t`Ask`}</Button>
						<Button size="sm" variant="ghost" onPress={onClose}>{t`Cancel`}</Button>
					</View>
				</View>
			);
		return (
			<View className="items-start">
				{options.map((option) => (
					<Button key={option.action} variant="ghost" size="sm" onPress={() => run(option.action)}>
						<Icon name={option.icon} size={16} />
						<Button.Label>{option.label}</Button.Label>
					</Button>
				))}
				<Button variant="ghost" size="sm" onPress={() => setAsking(true)}>
					<Icon name="chat-text" size={16} />
					<Button.Label>{t`Ask for something else…`}</Button.Label>
				</Button>
				<Button variant="ghost" size="sm" onPress={onClose}>
					<Icon name="x" size={16} />
					<Button.Label>{t`Cancel`}</Button.Label>
				</Button>
			</View>
		);
	};

	return (
		<Surface variant="secondary" className="gap-2 rounded-xl p-3" testID="improve-panel">
			<Text size="xs" weight="semibold" tone="muted">
				{t`Improve selected line`}
			</Text>
			<Text tone="muted" numberOfLines={2}>
				{line.text}
			</Text>
			{body()}
			<AIProviderSetupSheet open={setup} onClose={() => setSetup(false)} />
		</Surface>
	);
}
