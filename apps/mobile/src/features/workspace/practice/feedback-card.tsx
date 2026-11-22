// Feedback always has the same shape (what works, what to strengthen, an opening to try), so attempts compare.
import type { SavedData, SavedItem } from "../queries";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Block } from "../blocks";
import { Text, Typography } from "@/ui";

type Practice = SavedData<"practice">;
export type Attempt = SavedItem & { data: Practice };

type FeedbackCardProps = { data: Practice; children?: ReactNode };

export function FeedbackCard({ data, children }: FeedbackCardProps) {
	const { t } = useLingui();
	return (
		<Block title={data.title} testID="practice-feedback">
			<View className="gap-1 rounded-xl bg-success-soft p-3">
				<Text size="xs" weight="semibold" tone="success">{t`What works`}</Text>
				<Typography type="body-sm">{data.works}</Typography>
			</View>
			<View className="gap-1 rounded-xl bg-warning-soft p-3">
				<Text size="xs" weight="semibold" tone="warning">{t`Strengthen`}</Text>
				<Typography type="body-sm">{data.strengthen}</Typography>
			</View>
			<View className="gap-1 rounded-xl border-s-2 border-border bg-surface-secondary p-3">
				<Text size="xs" weight="semibold" tone="muted">{t`Try this opening`}</Text>
				<Typography type="body-sm" className="italic">{`“${data.opening}”`}</Typography>
			</View>
			{children}
		</Block>
	);
}

/** A practice attempt opened from Saved: its question, answer and feedback, read-only. */
export function SavedAttempt({ item }: { item: Attempt }) {
	const { t } = useLingui();
	const mode = item.data.mode === "spoken" ? t`spoken` : t`typed`;
	return (
		<View className="gap-4">
			<Block title={item.data.origin === "recalled" ? t`Recalled` : t`Practice`}>
				<Typography.Heading type="h5">{item.data.question}</Typography.Heading>
			</Block>
			<Block title={t`Your answer · ${mode}`}>
				<Typography type="body-sm">{item.data.answer}</Typography>
			</Block>
			<FeedbackCard data={item.data} />
		</View>
	);
}
