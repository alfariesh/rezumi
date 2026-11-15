import { Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { orpc } from "./api";
import { SelectField } from "./fields";
import { matchChips, matchPercent, matchResumeId } from "./match";
import { useSettings } from "./stores";

/** The value after it stopped changing for `ms` (the match runs again ±500 ms after typing, 02-teknis.md §10). */
function useSettled<T>(value: T, ms: number): T {
	const [settled, setSettled] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), ms);
		return () => clearTimeout(timer);
	}, [value, ms]);
	return settled;
}

/** The resumes to match with, and the one in use (aturan turunan #11), remembered on this device when changed. */
export function useMatchResume() {
	const resumes = useQuery(orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }));
	const [settings, updateSettings] = useSettings();
	const id = matchResumeId(resumes.data ?? [], settings?.matchResumeId ?? null);
	return {
		resumes: resumes.data,
		id,
		choose: (next: string) => void updateSettings({ matchResumeId: next || null }),
	};
}

type MatchSectionProps = {
	/** The posting's text as the form holds it now. */
	description: string;
};

/**
 * 01-desain.md §3.3 "Match": the resume picker, the share of the posting's terms the resume has, and keyword chips
 * (missing first, at most 12, the rest as "+N"). Free: `resume.matchTerms`, no AI.
 */
export function MatchSection({ description }: MatchSectionProps) {
	const { t } = useLingui();
	const resume = useMatchResume();
	const text = useSettled(description.trim().slice(0, 20_000), 500);
	const match = useQuery({
		...orpc.resume.matchTerms.queryOptions({ input: { id: resume.id ?? "", jobDescription: text } }),
		enabled: Boolean(resume.id && text),
		staleTime: 5 * 60_000,
		retry: false,
	});

	const percent = match.data ? matchPercent(match.data.found.length, match.data.total) : null;
	const chips = match.data ? matchChips(match.data.found, match.data.missing) : null;

	return (
		<section aria-labelledby="match-heading" className="flex flex-col gap-3 rounded-2xl border border-separator p-4">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id="match-heading" className="text-sm font-medium">
					<Trans comment="Browser extension: how well the job posting matches the person's resume">Match</Trans>
				</h2>
				{percent !== null ? (
					<p className="text-sm font-semibold tabular-nums" data-testid="match-percent">
						{t({
							message: `${percent}% of terms`,
							comment: "Browser extension: share of the posting's terms found in the resume",
						})}
					</p>
				) : null}
			</div>

			{resume.resumes && resume.resumes.length === 0 ? (
				<p className="text-sm text-muted">
					<Trans>Create a resume in Rezumi to see how well you match.</Trans>
				</p>
			) : (
				<SelectField
					label={t`Resume to compare`}
					value={resume.id ?? ""}
					isDisabled={!resume.resumes}
					options={(resume.resumes ?? []).map((item) => ({ value: item.id, label: item.name }))}
					onChange={resume.choose}
				/>
			)}

			{!text ? (
				<p className="text-xs text-muted">
					<Trans>Add the job description to see the match.</Trans>
				</p>
			) : match.isFetching && !match.data ? (
				<p role="status" className="flex items-center gap-2 text-xs text-muted">
					<Spinner size="sm" color="current" aria-hidden />
					<Trans>Comparing…</Trans>
				</p>
			) : match.isError ? (
				<p className="text-xs text-muted">
					<Trans>The match couldn't be worked out right now.</Trans>
				</p>
			) : match.data && match.data.total === 0 ? (
				<p className="text-xs text-muted">
					<Trans>No job terms found in this description.</Trans>
				</p>
			) : chips ? (
				<div className="flex flex-col gap-2" aria-live="polite">
					{chips.missing.length > 0 ? (
						<KeywordList
							label={t({ message: "Missing from your resume", comment: "Browser extension: keyword chips heading" })}
							terms={chips.missing}
							found={false}
						/>
					) : null}
					{chips.found.length > 0 ? (
						<KeywordList
							label={t({ message: "In your resume", comment: "Browser extension: keyword chips heading" })}
							terms={chips.found}
							found
						/>
					) : null}
					{chips.more > 0 ? (
						<p className="text-xs text-muted">{t({ message: `+${chips.more} more`, comment: "More keywords" })}</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}

type KeywordListProps = { label: string; terms: { term: string; label: string }[]; found: boolean };

function KeywordList({ label, terms, found }: KeywordListProps) {
	return (
		<div className="grid gap-1.5">
			<p className="text-xs text-muted">{label}</p>
			<ul aria-label={label} className="flex flex-wrap gap-1.5">
				{terms.map((term) => (
					<li
						key={term.term}
						className={
							found
								? "inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
								: "inline-flex items-center gap-1 rounded-full border border-separator px-2 py-0.5 text-xs"
						}
					>
						{found ? <Icon name="check" size={11} aria-hidden /> : null}
						{term.label}
					</li>
				))}
			</ul>
		</div>
	);
}
