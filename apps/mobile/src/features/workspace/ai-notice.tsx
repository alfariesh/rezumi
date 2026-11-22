// Where an AI button's data goes, said before it is pressed, and the way to add a connection when there is none. The
// consent itself runs per operation in the client (src/api/ai-consent.ts); Report AI content stays beside the answer.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { Notice } from "./blocks";
import { AIProviderSetupSheet, useHasAIProvider } from "@/features/ai/providers";
import { ReportAiContent } from "@/features/ai/report-content";
import { Button, Icon, Skeleton, Text, cx } from "@/ui";

type PrivacyLineProps = { children: string; centered?: boolean };

/** Names exactly what an AI action sends, and where. */
export function PrivacyLine({ children, centered = false }: PrivacyLineProps) {
	return (
		<View className={cx("flex-row gap-1.5", centered ? "justify-center" : "items-start")}>
			<Icon name="lock" size={14} tone="muted" />
			<Text size="xs" tone="muted" className={cx("shrink", centered && "text-center")}>
				{children}
			</Text>
		</View>
	);
}

/** Adds an AI connection in place (the sheet from AI settings). */
export function ConnectAi() {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button size="sm" variant="secondary" className="self-center" onPress={() => setOpen(true)}>
				<Icon name="key" size={16} />
				<Button.Label>{t`Connect an AI provider`}</Button.Label>
			</Button>
			<AIProviderSetupSheet open={open} onClose={() => setOpen(false)} />
		</>
	);
}

type AiNoticeProps = { sends?: string | undefined; centered?: boolean; report?: string | undefined };

/**
 * The privacy line for the default connection (with Report AI content), or, with no usable connection, the button
 * that adds one. Parts show their AI buttons only when `useHasAIProvider().defaultProvider` is set.
 */
export function AiNotice({ sends, centered = false, report }: AiNoticeProps) {
	const { t } = useLingui();
	const connection = useHasAIProvider();
	const provider = connection.defaultProvider;
	if (connection.isLoading) return <Skeleton variant="none" className="h-5 w-48 rounded-md" />;
	if (connection.error)
		return (
			<Notice
				status="danger"
				message={t`AI connections couldn't be loaded.`}
				action={{ label: t`Try again`, onPress: connection.retry }}
			/>
		);
	if (!provider) return <ConnectAi />;
	const label = provider.label;
	return (
		<View className={cx("gap-1", centered && "items-center")}>
			<PrivacyLine centered={centered}>
				{sends ??
					t`Sends this application's posting, notes and documents, plus your Profile if switched on, to ${label}.`}
			</PrivacyLine>
			<ReportAiContent source="career" {...(report ? { text: report } : {})} />
		</View>
	);
}
