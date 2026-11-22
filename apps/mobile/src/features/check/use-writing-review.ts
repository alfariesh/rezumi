import type { CheckIssue } from "./messages";
import type { WritingNote } from "@rezumi/resume/check";
import type { Proposal } from "@rezumi/resume/proposals";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { mapWritingReview } from "@rezumi/resume/check";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { collectPassages } from "@rezumi/resume/proposals";
import { describeEntry } from "@rezumi/resume/write";
import { getSectionName } from "./messages";
import { client } from "@/api/client";

/** The endpoint's caps; the text and lists are trimmed here so a long resume is never refused. */
const MAX_TEXT_CHARS = 50_000;
const MAX_FINDINGS = 120;
const MAX_PASSAGES = 120;
const MAX_PASSAGE_CHARS = 1_000;

export type WritingReview = { summary: string; strengths: string[]; proposals: Proposal[]; notes: WritingNote[] };

/** The passages a review may rewrite: bullets and paragraphs, labelled by where they are. */
export function usePassages(data: ResumeData) {
	const { t } = useLingui();
	return collectPassages(data, {
		summary: getSectionName(data, "summary"),
		sectionTitle: (sectionId) => getSectionName(data, sectionId),
		entryTitle: (type, entry) => describeEntry(type as never, entry as never).title,
		bullet: (n) => t`bullet ${n}`,
		paragraph: (n) => t`paragraph ${n}`,
	}).slice(0, MAX_PASSAGES);
}

/**
 * Runs the opt-in AI review of the wording. The transport asks for AI consent per operation; rewrites of passages
 * that were sent come back as proposals, the rest as notes.
 */
export function useWritingReview(data: ResumeData, issues: readonly CheckIssue[]) {
	const passages = usePassages(data);
	const [review, setReview] = useState<WritingReview | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);
	const controller = useRef<AbortController | null>(null);
	useEffect(() => () => controller.current?.abort(), []);

	const run = async (aiProviderId: string) => {
		if (controller.current || passages.length === 0) return;
		const request = new AbortController();
		controller.current = request;
		setPending(true);
		setError(false);
		try {
			const result = await client.ai.atsReview(
				{
					aiProviderId,
					extractedText: buildMarkdown(data).slice(0, MAX_TEXT_CHARS),
					findings: issues.slice(0, MAX_FINDINGS).map((issue) => ({
						code: issue.code,
						severity: issue.finding.severity,
						message: issue.title.slice(0, 300),
					})),
					passages: passages.map((passage) => ({
						id: passage.id,
						where: passage.location.slice(0, 200),
						text: passage.text.slice(0, MAX_PASSAGE_CHARS),
					})),
				},
				{ signal: request.signal },
			);
			if (!request.signal.aborted)
				setReview({
					summary: result.summary,
					strengths: result.strengths,
					...mapWritingReview(result.suggestions, passages),
				});
		} catch {
			if (!request.signal.aborted) setError(true);
		} finally {
			if (!request.signal.aborted) setPending(false);
			if (controller.current === request) controller.current = null;
		}
	};

	const cancel = () => {
		controller.current?.abort();
		controller.current = null;
		setPending(false);
	};

	const setStatus = (id: string, status: Proposal["status"]) =>
		setReview(
			(current) =>
				current && {
					...current,
					proposals: current.proposals.map((proposal) => (proposal.id === id ? { ...proposal, status } : proposal)),
				},
		);

	return { passages, review, pending, error, run, cancel, setStatus };
}
