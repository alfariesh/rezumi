import type { AiChoice } from "./ai";
import type { RouterOutput } from "./api";
import { Button, Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { rezumiLink } from "../shared/config";
import { aiFields, creditCost, showsCredits } from "./ai";
import { orpc } from "./api";
import { errorKind } from "./errors";
import { SelectField } from "./fields";
import { SaveError } from "./save-error";
import { useSettings } from "./stores";

/** "N credits left" while Rezumi AI runs the action; the trial when the first use brings credits. */
function useBalanceText(choice: AiChoice) {
	const { t } = useLingui();
	if (!showsCredits(choice)) return null;
	if (choice.trial && choice.balance === 0)
		return t({ message: "Your first use adds free credits.", comment: "Browser extension: Rezumi AI trial credits" });
	return t({
		message: `${choice.balance} credits left`,
		comment: "Browser extension: the account's Rezumi AI credit balance",
	});
}

type AiSourcePickerProps = { choice: AiChoice };

/** Rezumi AI or the account's own connection, when it has both (remembered on this device, like the web's menu). */
export function AiSourcePicker({ choice }: AiSourcePickerProps) {
	const { t } = useLingui();
	const [, updateSettings] = useSettings();
	if (!choice.choice || !choice.hasOwn) return null;
	return (
		<SelectField
			label={t`Run AI with`}
			value={choice.source ?? "rezumi"}
			options={[
				{ value: "rezumi", label: t`Rezumi AI (uses credits)` },
				{ value: "own", label: t`Your AI connection` },
			]}
			onChange={(source) => {
				if (source === "rezumi" || source === "own") void updateSettings({ aiSource: source });
			}}
		/>
	);
}

type ReadWithAiProps = {
	choice: AiChoice & { loading: boolean };
	isSelected: boolean;
	onChange: (on: boolean) => void;
};

/**
 * 01-desain.md §3.3 item 5: "Read with AI" with its cost and the balance before it runs; off, with the reason, when no
 * AI can run (aturan turunan #3 keeps the last choice).
 */
export function ReadWithAiSwitch({ choice, isSelected, onChange }: ReadWithAiProps) {
	const { t } = useLingui();
	const balance = useBalanceText(choice);
	const unavailable = !choice.loading && !choice.source;
	const cost = creditCost("short-text");
	const description = unavailable
		? t`No AI is set up for your account. Add an AI connection in Rezumi's settings to use this.`
		: showsCredits(choice)
			? t({
					message: `Fills the fields from the posting's text. Uses ${cost} credit each time.`,
					comment: "Browser extension: Read with AI, paid with Rezumi AI credits",
				})
			: t`Fills the fields from the posting's text with your AI connection.`;
	return (
		<div className="grid gap-1">
			<SwitchRow
				isSelected={isSelected && !unavailable}
				isDisabled={unavailable}
				onChange={onChange}
				label={t`Read with AI`}
				description={description}
			/>
			{balance && !unavailable ? <p className="text-xs text-muted">{balance}</p> : null}
		</div>
	);
}

type Application = RouterOutput["applications"]["getById"];

type AiScoreProps = {
	application: Application;
	/** The resume the match uses, linked to the application first when it has none (the AI score compares that one). */
	resumeId: string | null;
	choice: AiChoice & { loading: boolean };
};

type Score = { score: number; gaps: string[]; strengths: string[] };

/** The last AI score kept on the application (`aiMetadata.matchScore`), if any. */
function storedScore(application: Application): Score | null {
	const stored = application.aiMetadata?.matchScore as Partial<Score> | undefined;
	if (application.matchScore === null) return null;
	return {
		score: application.matchScore,
		gaps: Array.isArray(stored?.gaps) ? stored.gaps.filter((item) => typeof item === "string") : [],
		strengths: Array.isArray(stored?.strengths) ? stored.strengths.filter((item) => typeof item === "string") : [],
	};
}

/** 01-desain.md §3.4: "AI score (4 credits)" after saving, with the score and short reasons. */
export function AiScore({ application, resumeId, choice }: AiScoreProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const link = useMutation(orpc.applications.update.mutationOptions());
	const score = useMutation(orpc.applications.ai.matchScore.mutationOptions());
	const [key, setKey] = useState(() => crypto.randomUUID());
	const result = score.data ?? storedScore(application);
	const cost = creditCost("review");
	const balance = useBalanceText(choice);
	const needsResume = !application.resumeId && !resumeId;
	const needsText = !application.jobDescription?.trim();
	const unavailable = !choice.loading && !choice.source;

	const run = async () => {
		if (!application.resumeId && resumeId) await link.mutateAsync({ id: application.id, resumeId });
		await score.mutateAsync({ id: application.id, ...aiFields(choice, key) });
		setKey(crypto.randomUUID());
		void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
	};

	return (
		<section aria-labelledby="ai-score-heading" className="flex flex-col gap-3 rounded-2xl border border-separator p-4">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id="ai-score-heading" className="text-sm font-medium">
					<Trans comment="Browser extension: the AI's fit score for this job">AI score</Trans>
				</h2>
				{result ? (
					<p className="text-sm font-semibold tabular-nums" data-testid="ai-score">
						{result.score}/100
					</p>
				) : null}
			</div>
			{result && (result.strengths.length > 0 || result.gaps.length > 0) ? (
				<div className="grid gap-2 text-sm">
					{result.strengths.length > 0 ? (
						<div className="grid gap-1">
							<p className="text-xs text-muted">
								<Trans>Strengths</Trans>
							</p>
							<ul className="grid gap-0.5">
								{result.strengths.slice(0, 4).map((item) => (
									<li key={item} className="flex gap-1.5">
										<Icon name="check" size={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
										{item}
									</li>
								))}
							</ul>
						</div>
					) : null}
					{result.gaps.length > 0 ? (
						<div className="grid gap-1">
							<p className="text-xs text-muted">
								<Trans>Gaps</Trans>
							</p>
							<ul className="grid gap-0.5">
								{result.gaps.slice(0, 4).map((item) => (
									<li key={item} className="flex gap-1.5">
										<Icon name="minus" size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
										{item}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			) : null}
			{needsText ? (
				<p className="text-xs text-muted">
					<Trans>Add the job description in Rezumi to get an AI score.</Trans>
				</p>
			) : needsResume ? (
				<p className="text-xs text-muted">
					<Trans>Pick a resume above to get an AI score.</Trans>
				</p>
			) : unavailable ? (
				<p className="text-xs text-muted">
					<Trans>No AI is set up for your account.</Trans>{" "}
					<a href={rezumiLink("/dashboard/settings/ai")} target="_blank" rel="noreferrer" className="underline">
						<Trans>Set up AI</Trans>
					</a>
				</p>
			) : (
				<>
					<AiSourcePicker choice={choice} />
					<Button
						size="sm"
						variant="secondary"
						isPending={link.isPending || score.isPending}
						onPress={() => void run().catch(() => {})}
					>
						{link.isPending || score.isPending ? (
							<Spinner size="sm" color="current" aria-hidden />
						) : (
							<Icon name="sparkle" size={14} aria-hidden />
						)}
						{showsCredits(choice)
							? t({
									message: `AI score (${cost} credits)`,
									comment: "Browser extension button: score this job with AI, showing its credit cost",
								})
							: result
								? t`Score again with AI`
								: t`AI score`}
					</Button>
					{balance ? <p className="text-xs text-muted">{balance}</p> : null}
				</>
			)}
			<div aria-live="polite">
				{score.isError || link.isError ? (
					<SaveError kind={errorKind(score.error ?? link.error)} onRetry={() => void run().catch(() => {})} />
				) : null}
			</div>
		</section>
	);
}
