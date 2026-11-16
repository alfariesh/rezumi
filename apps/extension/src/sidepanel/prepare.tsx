import type { RouterOutput } from "./api";
import { Button, buttonVariants } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { orpc } from "./api";
import { errorKind } from "./errors";
import { SaveError } from "./save-error";

type Application = RouterOutput["applications"]["getById"];

/**
 * Where "Tailor resume" opens: the application's page on the web with "Copy for a job" open for it
 * (apps/web/src/features/applications/extension-links.ts), starting from the linked resume or the one the match uses.
 */
function tailorResumeLink(applicationId: string, resumeId: string | null): string {
	const search = new URLSearchParams({ prepare: "resume", ...(resumeId ? { from: resumeId } : {}) });
	return rezumiLink(`/dashboard/applications/${encodeURIComponent(applicationId)}?${search.toString()}`);
}

/** The application's letter in the web editor. */
const letterLink = (coverLetterId: string) => rezumiLink(`/builder/letter/${encodeURIComponent(coverLetterId)}`);

type PrepareSectionProps = {
	application: Application;
	/** The resume the match uses, for "Tailor resume" when the application has none linked. */
	matchResumeId: string | null;
};

/**
 * 01-desain.md §3.4 "Preparation": Tailor resume · Write cover letter · Open in Rezumi, each in a new web tab. The AI
 * work (tailoring, drafting the letter) happens there, with its costs shown there (the extension's rule: heavy AI stays
 * on the web).
 */
export function PrepareSection({ application, matchResumeId }: PrepareSectionProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const createLetter = useMutation(orpc.coverLetters.create.mutationOptions());

	// As the web's "Write": a structured letter for this job, its recipient filled from the application, then the editor.
	const writeLetter = () =>
		createLetter.mutate(
			{
				name: t`Cover letter — ${application.company}`.slice(0, 100),
				applicationId: application.id,
				...(application.resumeId ? { resumeId: application.resumeId } : {}),
			},
			{
				onSuccess: (letter) => {
					void chrome.tabs.create({ url: letterLink(letter.id) });
					void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
				},
			},
		);

	const linkClass = buttonVariants({ variant: "secondary", size: "sm", fullWidth: true, className: "justify-start" });

	return (
		<section aria-labelledby="prepare-heading" className="flex flex-col gap-2">
			<h2 id="prepare-heading" className="text-xs font-semibold text-muted">
				<Trans comment="Browser extension: buttons that open Rezumi's tools for preparing this application">
					Prepare
				</Trans>
			</h2>
			<a
				href={tailorResumeLink(application.id, application.resumeId ?? matchResumeId)}
				target="_blank"
				rel="noreferrer"
				className={linkClass}
			>
				<Icon name="file-text" size={16} aria-hidden />
				<span className="flex-1 text-start">
					<Trans comment="Browser extension: open Rezumi to make a copy of a resume tailored to this job">
						Tailor resume
					</Trans>
				</span>
				<Icon name="arrow-square-out" size={14} aria-hidden />
			</a>
			{application.coverLetterId ? (
				<a href={letterLink(application.coverLetterId)} target="_blank" rel="noreferrer" className={linkClass}>
					<Icon name="envelope-simple" size={16} aria-hidden />
					<span className="flex-1 text-start">
						<Trans>Open cover letter</Trans>
					</span>
					<Icon name="arrow-square-out" size={14} aria-hidden />
				</a>
			) : (
				<Button
					size="sm"
					variant="secondary"
					fullWidth
					className="justify-start"
					isPending={createLetter.isPending}
					onPress={writeLetter}
				>
					<Icon name="envelope-simple" size={16} aria-hidden />
					<span className="flex-1 text-start">
						<Trans comment="Browser extension: start a cover letter for this job in Rezumi">Write cover letter</Trans>
					</span>
					<Icon name="arrow-square-out" size={14} aria-hidden />
				</Button>
			)}
			<a
				href={rezumiLink(`/dashboard/applications/${encodeURIComponent(application.id)}`)}
				target="_blank"
				rel="noreferrer"
				className={linkClass}
			>
				<Icon name="briefcase" size={16} aria-hidden />
				<span className="flex-1 text-start">
					<Trans>Open in Rezumi</Trans>
				</span>
				<Icon name="arrow-square-out" size={14} aria-hidden />
			</a>
			{createLetter.isError ? <SaveError kind={errorKind(createLetter.error)} onRetry={writeLetter} /> : null}
		</section>
	);
}
