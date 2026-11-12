import { Button, Description, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { PORTFOLIO_AI_NOTE_LENGTH } from "@rezumi/schema/portfolio/ai";
import { portfolioAiErrorMessage } from "../errors";
import { useRequestSignals } from "../images/use-request-signals";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { client } from "@/libs/orpc/client";

type DraftRequest = { note?: string; workIds?: string[] };

/** Runs one AI draft. `stop`, or leaving, cancels it, and its credits come back. */
export function useDraftRun() {
	const ai = useAiSource();
	const signals = useRequestSignals();
	const mutation = useMutation({
		mutationFn: (request: DraftRequest) =>
			client.portfolio.ai.draft({ ...request, ...aiSourceFields(ai) }, { signal: signals.next() }),
	});
	return {
		run: mutation.mutateAsync,
		stop: () => signals.cancel(),
		isRunning: mutation.isPending,
	};
}

/** What to tell the person when a draft didn't come back: they stopped it, or why it failed. */
export function draftFailure(error: unknown, stopped: boolean): string {
	if (stopped) return t`Stopped. Any credits it held come back to you.`;
	return portfolioAiErrorMessage(error, t`Couldn't write your draft. Nothing changed. Try again.`);
}

type DraftNoteProps = { value: string; onChange: (value: string) => void };

/** The optional note a draft takes. */
export function DraftNote({ value, onChange }: DraftNoteProps) {
	return (
		<TextField fullWidth value={value} maxLength={PORTFOLIO_AI_NOTE_LENGTH} onChange={onChange} className="gap-1.5">
			<Label>
				<Trans>Anything to stress or leave out? (optional)</Trans>
			</Label>
			<TextArea
				variant="secondary"
				className="min-h-20"
				placeholder={t`I want freelance branding work, so lead with my client projects.`}
			/>
			<Description>
				<Trans>
					AI only uses what's on your resume and in this note. It won't make up numbers, clients or results.
				</Trans>
			</Description>
		</TextField>
	);
}

type DraftProgressProps = { onStop: () => void };

/** A draft being written, with the way out. */
export function DraftProgress({ onStop }: DraftProgressProps) {
	return (
		<div role="status" className="grid justify-items-center gap-3 py-8 text-center">
			<Spinner size="lg" color="current" />
			<div className="grid gap-1">
				<p className="text-sm font-medium">
					<Trans>Writing your draft…</Trans>
				</p>
				<p className="text-body-xs text-muted">
					<Trans>This usually takes less than a minute.</Trans>
				</p>
			</div>
			<Button size="sm" variant="secondary" onPress={onStop}>
				<Trans>Stop</Trans>
			</Button>
		</div>
	);
}
