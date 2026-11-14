import type { PageReading, ReadingSummary, ShownFieldName } from "./reading";
import type { ReactNode } from "react";
import { Button, buttonVariants, Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { EXTENSION_VERSION, rezumiLink } from "../shared/config";
import { orpc } from "./api";
import { useTabReading } from "./page";
import { SHOWN_FIELDS, summarizeReading } from "./reading";

/**
 * What the panel shows for the open tab (01-desain.md §3.2, §3.5, §3.6): the posting it read, "pick a posting" on a
 * search page with none open, or "no posting here" with a report. Saving arrives in Phase 04; development builds add
 * the raw reading underneath (where each field came from).
 */
export function PageScreen() {
	const tab = useTabReading();

	if (tab.isPending) {
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-muted">
				<Spinner size="sm" color="current" aria-hidden />
				<Trans comment="Browser extension status while it reads the open web page">Reading this page…</Trans>
			</p>
		);
	}
	if (tab.data?.state !== "read") return <HomeScreen />;
	return <ReadingView reading={tab.data.reading} />;
}

/** Development builds list the raw reading under the panel, unless `?clean` asks for the plain view (screenshots). */
const showDebug = __DEV__ && !new URLSearchParams(location.search).has("clean");

type ReadingViewProps = { reading: PageReading };

function ReadingView({ reading }: ReadingViewProps) {
	const summary = useMemo(() => summarizeReading(reading), [reading]);

	let body: ReactNode;
	if (reading.site && !reading.key) body = <PickPosting />;
	// A page with text but no JobPosting may still be one (many career pages); saving reads it with AI (Phase 04).
	else if (summary.kind !== "none") body = <PostingPreview reading={reading} summary={summary} />;
	else body = <NoPosting reading={reading} summary={summary} />;

	return (
		<div className="flex flex-col gap-4">
			{body}
			{showDebug ? <DebugReading reading={reading} summary={summary} /> : null}
		</div>
	);
}

/** 01-desain.md §3.2, before the lists: what to do next. */
function HomeScreen() {
	return (
		<section className="flex flex-col items-center gap-y-4 px-2 py-8 text-center">
			<span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-control text-muted">
				<Icon name="briefcase" size={24} />
			</span>
			<p className="text-sm text-balance text-muted">
				<Trans comment="Browser extension home screen when the open tab is not a job posting">
					Open a job posting to save it to Rezumi.
				</Trans>
			</p>
			<ExternalButton href={rezumiLink("/dashboard/applications")}>
				<Trans comment="Button in the browser extension that opens the application tracker on the web">
					Open application tracker
				</Trans>
			</ExternalButton>
		</section>
	);
}

/** 01-desain.md §3.6: a search page with no posting open beside the list. */
function PickPosting() {
	return (
		<section className="flex flex-col items-center gap-y-4 px-2 py-8 text-center">
			<span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-control text-muted">
				<Icon name="list-magnifying-glass" size={24} />
			</span>
			<p className="text-sm text-balance text-muted">
				<Trans comment="Browser extension on a job board search page with no posting selected">
					Pick one job posting to save it.
				</Trans>
			</p>
		</section>
	);
}

type PostingPreviewProps = { reading: PageReading; summary: ReadingSummary };

/** 01-desain.md §3.3, first part: what was read. Editing and saving arrive in Phase 04. */
function PostingPreview({ reading, summary }: PostingPreviewProps) {
	const { fields, missing } = summary;
	return (
		<section aria-labelledby="posting-heading" className="flex flex-col gap-3">
			<div className="flex flex-col gap-1 rounded-2xl border border-separator p-4">
				<h2 id="posting-heading" className="text-base font-semibold text-balance">
					{fields.role?.value ?? reading.pageTitle}
				</h2>
				{fields.company ? <p className="text-sm">{fields.company.value}</p> : null}
				<dl className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
					{fields.location ? <Detail icon="map-pin">{fields.location.value}</Detail> : null}
					{fields.salary ? <Detail icon="tag">{fields.salary.value}</Detail> : null}
					{fields.employmentType ? <Detail icon="briefcase">{fields.employmentType.value}</Detail> : null}
					{fields.validThrough ? <Detail icon="calendar-blank">{fields.validThrough.value}</Detail> : null}
				</dl>
			</div>
			{missing.length > 0 ? (
				<div className="flex flex-col gap-2 text-sm text-muted">
					<p>
						<Trans comment="Browser extension note when some details of a job posting could not be read">
							Some details could not be read from this page.
						</Trans>
					</p>
					<ReportPage reading={reading} missing={missing} align="start" />
				</div>
			) : null}
		</section>
	);
}

type DetailProps = { icon: "map-pin" | "tag" | "briefcase" | "calendar-blank"; children: ReactNode };

function Detail({ icon, children }: DetailProps) {
	return (
		<div className="flex items-start gap-2">
			<dt className="pt-0.5">
				<Icon name={icon} size={14} aria-hidden />
			</dt>
			<dd className="min-w-0 flex-1 break-words">{children}</dd>
		</div>
	);
}

type NoPostingProps = { reading: PageReading; summary: ReadingSummary };

/** 01-desain.md §3.5: no posting found. Pasting a description and saving a selection arrive in Phase 04. */
function NoPosting({ reading, summary }: NoPostingProps) {
	return (
		<section className="flex flex-col items-center gap-y-4 px-2 py-8 text-center">
			<span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-control text-muted">
				<Icon name="magnifying-glass" size={24} />
			</span>
			<p className="text-sm text-balance text-muted">
				<Trans comment="Browser extension message when the open page has no job posting it can read">
					We couldn't find a job posting on this page.
				</Trans>
			</p>
			<ReportPage reading={reading} missing={summary.missing} />
		</section>
	);
}

type ReportPageProps = {
	reading: PageReading;
	missing: ShownFieldName[];
	/** Centered under an empty state, or at the start under a notice. */
	align?: "center" | "start";
};

/**
 * "Report this page" (aturan turunan #8, confirmed 2026-11-14): sends only the address, the board, the extension's
 * version and the fields that could not be read, and only when the person presses it. Never the page's text.
 */
function ReportPage({ reading, missing, align = "center" }: ReportPageProps) {
	const { t } = useLingui();
	const report = useMutation(orpc.applications.reportCapture.mutationOptions());

	if (report.isSuccess) {
		return (
			<p role="status" className="flex items-center gap-2 text-sm text-success">
				<Icon name="check-circle" size={16} aria-hidden />
				<Trans comment="Browser extension confirmation after the person reported a page it could not read">
					Thanks, we'll look into it.
				</Trans>
			</p>
		);
	}
	const limited = report.error instanceof ORPCError && report.error.code === "RATE_LIMIT_EXCEEDED";
	return (
		<div
			className={
				align === "center" ? "flex flex-col items-center gap-2 text-center" : "flex flex-col items-start gap-2"
			}
		>
			<Button
				variant="secondary"
				size="sm"
				isPending={report.isPending}
				onPress={() =>
					report.mutate({
						url: reading.url,
						site: reading.site,
						extensionVersion: EXTENSION_VERSION,
						missing,
					})
				}
			>
				<Icon name="bug" size={16} aria-hidden />
				<Trans comment="Browser extension button that tells Rezumi a page could not be read">Report this page</Trans>
			</Button>
			<p className="text-xs text-balance text-muted">
				<Trans comment="Under the report button: what a page report contains">
					Sends this page's address and which details were missing, not its content.
				</Trans>
			</p>
			{report.isError ? (
				<p role="alert" className="text-xs text-danger">
					{limited ? t`Wait a while, then try again.` : t`The report could not be sent. Try again.`}
				</p>
			) : null}
		</div>
	);
}

type DebugReadingProps = { reading: PageReading; summary: ReadingSummary };

/** Development builds only (Phase 03 step 7): every field with where it came from, to fix a board's reader later. */
function DebugReading({ reading, summary }: DebugReadingProps) {
	return (
		<details data-testid="debug-reading" className="rounded-xl border border-dashed border-separator p-3 text-xs" open>
			<summary className="cursor-pointer font-medium">Page reading (development build)</summary>
			<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<dt className="text-muted">key</dt>
				<dd data-field="key" className="break-all">
					{reading.key ?? "—"}
				</dd>
				<dt className="text-muted">kind</dt>
				<dd data-field="kind">{summary.kind}</dd>
				{SHOWN_FIELDS.map((name) => {
					const field = summary.fields[name];
					return [
						<dt key={`${name}-name`} className="text-muted">
							{name}
						</dt>,
						<dd key={`${name}-value`} data-field={name} data-source={field?.source ?? "none"} className="break-words">
							{field
								? `[${field.source}] ${name === "description" ? `${field.value.length} chars` : field.value}`
								: "—"}
						</dd>,
					];
				})}
				<dt className="text-muted">json-ld</dt>
				<dd data-field="jsonLd">{reading.jsonLd.length} block(s)</dd>
				<dt className="text-muted">missing</dt>
				<dd data-field="missing">{summary.missing.join(", ") || "—"}</dd>
			</dl>
		</details>
	);
}

type ExternalButtonProps = { href: string; children: ReactNode };

/** A link styled as a secondary button that opens Rezumi on the web in a new tab. */
function ExternalButton({ href, children }: ExternalButtonProps) {
	return (
		<a href={href} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
			{children}
			<Icon name="arrow-square-out" size={14} aria-hidden />
		</a>
	);
}
