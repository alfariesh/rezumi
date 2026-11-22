import type { useWritingReview } from "./use-writing-review";
import type { WritingNote } from "@rezumi/resume/check";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { applyProposal, canApply } from "@rezumi/resume/proposals";
import { useCheckActions } from "./actions";
import { CheckSection } from "./check-section";
import { ProposalCard } from "./proposal-card";
import { ProviderSheet } from "./provider-sheet";
import { useResumeStore } from "@/draft";
import { useHasAIProvider } from "@/features/ai/providers";
import { ReportAiContent } from "@/features/ai/report-content";
import { routes } from "@/routes";
import { Alert, Button, Chip, EmptyState, Icon, Skeleton, Spinner, Text, Typography } from "@/ui";

type WritingTabProps = {
	id: string;
	data: ResumeData;
	locked: boolean;
	offline: boolean;
	writing: ReturnType<typeof useWritingReview>;
};

/**
 * Writing: an opt-in AI review of the wording. It says what it sends before it runs, returns rewrites of bullets
 * and paragraphs as proposals to accept or reject, and is never part of the score. Its errors stay in this tab.
 */
export function WritingTab({ id, data, locked, offline, writing }: WritingTabProps) {
	const { t } = useLingui();
	const router = useRouter();
	const providers = useHasAIProvider();
	const { edit } = useCheckActions(id);
	const [providerId, setProviderId] = useState<string | null>(null);
	const [choosing, setChoosing] = useState(false);
	const provider = providers.usableProviders.find((entry) => entry.id === providerId) ?? providers.defaultProvider;
	const { review, passages } = writing;
	const run = () => provider && void writing.run(provider.id);
	const openSettings = () => router.push(routes.account("ai-providers"));

	if (providers.isLoading) return <Skeleton variant="none" className="h-48 w-full rounded-2xl" />;
	if (providers.error)
		return (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load AI providers.`}
				action={{ label: t`Retry`, onPress: providers.retry }}
			/>
		);

	if (!providers.hasAIProvider)
		return (
			<CheckSection icon="sparkle" title={t`AI review`}>
				<Typography.Heading type="h6">{t`A second opinion on your wording`}</Typography.Heading>
				<Typography type="body-sm" className="text-muted">
					{t`Connect your own AI provider to have a language model read your bullets and suggest rewrites. Issues and Job match need no provider.`}
				</Typography>
				<Button variant="secondary" className="self-start" onPress={openSettings}>
					<Button.Label>{t`Open AI settings`}</Button.Label>
				</Button>
			</CheckSection>
		);

	if (writing.pending)
		return (
			<CheckSection icon="sparkle" title={t`AI review`}>
				<View className="flex-row items-center gap-3" accessibilityLiveRegion="polite">
					<Spinner size="sm" />
					<Text tone="muted" className="flex-1">
						{plural(passages.length, {
							one: "Reading # passage of your resume…",
							other: "Reading # bullets and paragraphs of your resume…",
						})}
					</Text>
				</View>
				<Button variant="ghost" className="self-start" onPress={writing.cancel}>
					<Button.Label>{t`Cancel`}</Button.Label>
				</Button>
			</CheckSection>
		);

	if (!review || writing.error)
		return (
			<CheckSection icon="sparkle" title={t`AI review`} testID="writing-intro">
				{writing.error ? (
					<Alert status="danger">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>{t`The review couldn't finish. Try again.`}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : (
					<>
						<Typography.Heading type="h6">{t`A second opinion on your wording`}</Typography.Heading>
						<Typography type="body-sm" className="text-muted">
							{t`The checks are mechanical. This asks a language model how a reader might react to your bullets and suggests rewrites. It isn't part of the score.`}
						</Typography>
					</>
				)}
				<View className="flex-row flex-wrap items-center gap-2">
					<Icon name="lock" size={16} tone="muted" />
					<Text size="xs" tone="muted" className="shrink">
						{provider?.managed
							? t`Sends your resume's text only to ${provider.label}.`
							: t`Sends your resume's text only to ${provider?.label} · ${provider?.model}, with your key.`}
					</Text>
					<Button variant="tertiary" size="sm" onPress={() => setChoosing(true)}>
						<Button.Label>{t`Change`}</Button.Label>
					</Button>
				</View>
				<Button isDisabled={offline || passages.length === 0} onPress={run} testID="writing-run">
					<Icon name="sparkle" size={20} tone="accent-foreground" />
					<Button.Label>{writing.error ? t`Retry` : t`Review writing`}</Button.Label>
				</Button>
				{writing.error ? (
					<Button variant="secondary" onPress={openSettings}>
						<Button.Label>{t`Open AI settings`}</Button.Label>
					</Button>
				) : null}
				{offline ? (
					<Text tone="muted">{t`You're offline. Issues and Job match still work; reconnect for Writing and PDF checks.`}</Text>
				) : null}
				{passages.length === 0 ? (
					<Text tone="muted">{t`Add a summary or describe a role first; there's nothing to review yet.`}</Text>
				) : null}
				<ProviderSheet
					isOpen={choosing}
					onOpenChange={setChoosing}
					providers={providers.usableProviders}
					value={provider?.id ?? null}
					onPick={setProviderId}
				/>
			</CheckSection>
		);

	const accept = (proposal: (typeof review.proposals)[number]) => {
		const current = useResumeStore.getState();
		if (!current.data || !canApply(current.data, proposal)) return;
		if (edit((draft) => void applyProposal(draft, proposal), t`Rewrite accepted`))
			writing.setStatus(proposal.id, "accepted");
	};

	return (
		<View className="gap-6">
			{review.summary || review.strengths.length > 0 ? (
				<CheckSection icon="sparkle" title={t`AI review`}>
					{review.summary ? (
						<Typography type="body-sm" className="text-muted">
							{review.summary}
						</Typography>
					) : null}
					{review.strengths.length > 0 ? (
						<View className="gap-1">
							<Text weight="semibold">{t`What's working`}</Text>
							{review.strengths.map((strength) => (
								<Typography key={strength} type="body-sm" className="text-muted">
									{`• ${strength}`}
								</Typography>
							))}
						</View>
					) : null}
				</CheckSection>
			) : null}
			{review.proposals.length > 0 ? (
				<CheckSection icon="pencil-simple" title={t`Suggested rewrites`}>
					{review.proposals.map((proposal) => (
						<ProposalCard
							key={proposal.id}
							proposal={proposal}
							data={data}
							locked={locked}
							onAccept={accept}
							onReject={(entry) => writing.setStatus(entry.id, "rejected")}
						/>
					))}
				</CheckSection>
			) : null}
			{review.notes.length > 0 ? (
				<CheckSection icon="note" title={t`Notes`}>
					{review.notes.map((note) => (
						<NoteCard key={`${note.location}:${note.note}`} note={note} />
					))}
				</CheckSection>
			) : null}
			<View className="gap-2 px-1">
				<Typography type="body-xs" className="text-muted">
					{t`A model's opinion, not a verdict. It can be wrong.`}
				</Typography>
				<View className="flex-row flex-wrap gap-2">
					<Button variant="tertiary" size="sm" isDisabled={offline} onPress={run}>
						<Button.Label>{t`Run again`}</Button.Label>
					</Button>
					<ReportAiContent source="writing" text={JSON.stringify(review, null, 2)} />
				</View>
			</View>
		</View>
	);
}

type NoteCardProps = { note: WritingNote };

function NoteCard({ note }: NoteCardProps) {
	const { t } = useLingui();
	const impact = { high: t`High`, medium: t`Medium`, low: t`Low` }[note.impact];
	return (
		<View className="gap-2 rounded-2xl bg-surface-secondary p-3">
			<View className="flex-row items-start justify-between gap-2">
				<Text size="xs" mono tone="muted" className="shrink">
					{note.location}
				</Text>
				<Chip size="sm" variant="soft" color={note.impact === "high" ? "warning" : "default"}>
					<Chip.Label>{impact}</Chip.Label>
				</Chip>
			</View>
			<Typography type="body-sm">{note.quote ? `“${note.quote}” ${note.note}` : note.note}</Typography>
		</View>
	);
}
