import type { ExtractProgress } from "./extract-client";
import type { AtsCheckResult } from "./run-ats-check";
import type { PdfAtsReport, PdfCategory } from "@rezumi/resume/ats-pdf";
import type { CSSProperties } from "react";
import type { DropEvent } from "react-aria";
import { DropZone } from "@heroui-pro/react";
import { Alert, Button, Disclosure, Label, Spinner, Tabs, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { isFileDropItem } from "react-aria-components";
import { useIsClient } from "usehooks-ts";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { PdfPasswordRequiredError, PdfTooLargeError, PdfUnreadableError } from "./extract-client";
import { getPdfCategoryDescription, getPdfCategoryLabel, getPdfFindingMessage } from "./messages";
import { savePendingImport, takePendingImport } from "./pending-import";
import { runAtsCheck } from "./run-ats-check";
import { RollingNumber } from "@/components/ui/rolling-number";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { ENTER_CLASS, POP_CLASS, stagger } from "@/libs/motion";
import { client } from "@/libs/orpc/client";

// PDF.js and the importers load only once there is a file, so the page's first screen stays light and prerenderable.
const PdfViewer = lazy(() => import("./pdf-viewer").then((module) => ({ default: module.PdfViewer })));
const loadReadFile = () => import("@/features/resume/import/read-file");

const MAX_POSTING = 20_000;
const SAMPLE = { url: "/templates/pdf/onyx.pdf", name: "Sample resume.pdf" };

type State =
	| { name: "idle"; error?: string }
	| { name: "busy"; file: File; step: number }
	| { name: "done"; file: File; result: AtsCheckResult }
	| { name: "importing" };

const stepOf = (progress: ExtractProgress) => (progress.phase === "loading" ? 0 : progress.phase === "text" ? 1 : 2);

function describeError(error: unknown) {
	if (error instanceof PdfPasswordRequiredError)
		return t`This PDF is password protected. Save an unprotected copy and try again.`;
	if (error instanceof PdfTooLargeError) return t`That file is too large to check. PDFs up to 25 MB work.`;
	if (error instanceof PdfUnreadableError)
		return t`That file couldn't be read as a PDF. Choose a PDF file and try again.`;
	return t`Couldn't read that file. Try again.`;
}

type AtsCheckerProps = {
	signedIn: boolean;
	/** Back from signing up with a file waiting to be imported. */
	importPending: boolean;
};

/**
 * The public checker: drop a PDF, watch three steps, then see the score, what could cost a match, and the file as
 * software reads it. "Fix these in the editor" imports the same file (after signing up, if needed) and opens Check.
 */
export function AtsChecker({ signedIn, importPending }: AtsCheckerProps) {
	const navigate = useNavigate();
	const [state, setState] = useState<State>({ name: "idle" });
	const [posting, setPosting] = useState("");
	const abort = useRef<AbortController | null>(null);

	const check = async (file: File) => {
		abort.current?.abort();
		const controller = new AbortController();
		abort.current = controller;
		setState({ name: "busy", file, step: 0 });
		try {
			const result = await runAtsCheck(file, {
				jobDescription: posting,
				signal: controller.signal,
				onProgress: (progress) => setState({ name: "busy", file, step: stepOf(progress) }),
			});
			if (controller.signal.aborted) return;
			setState({ name: "done", file, result });
		} catch (error) {
			if (!controller.signal.aborted) setState({ name: "idle", error: describeError(error) });
		}
	};

	const importAndOpen = async (file: File) => {
		setState({ name: "importing" });
		let readFile: Awaited<ReturnType<typeof loadReadFile>> | undefined;
		try {
			readFile = await loadReadFile();
			// Read in the browser, the same way the check did, so every issue lines up in Check.
			const data = await readFile.readResumeFile(file, "pdf", { aiAvailable: false });
			const resumeId = await client.resume.import({ data });
			await navigate({ to: "/builder/$resumeId", params: { resumeId }, search: { mode: "check" } });
		} catch (error) {
			setState({
				name: "idle",
				error:
					readFile && error instanceof readFile.ImportError
						? error.message
						: getOrpcErrorMessage(error, { fallback: t`Couldn't import the file. Try again from Documents.` }),
			});
		}
	};

	const fix = async (file: File) => {
		if (signedIn) return importAndOpen(file);
		await savePendingImport(file);
		await navigate({ to: "/auth/register", search: { callbackURL: "/ats-checker?import=1" } });
	};

	// Signed up (or in) with a file waiting: import it straight away.
	const resumed = useRef(false);
	useEffect(() => {
		if (!signedIn || !importPending || resumed.current) return;
		resumed.current = true;
		void takePendingImport().then((file) => {
			if (file) void importAndOpen(file);
			else void navigate({ to: "/ats-checker", replace: true });
		});
	});

	useEffect(() => () => abort.current?.abort(), []);
	// The first state is already on screen (the page is prerendered), so only the states that replace it fade in;
	// fading it too would hold back the page's largest paint until the app had loaded.
	const replacing = useIsClient();

	// Each state fades in as it replaces the last. Opacity only: a translate here would make this wrapper the
	// containing block for the result's fixed mobile bar while it animates.
	return (
		<div
			key={state.name}
			className={cn(replacing && "transition-opacity duration-standard ease-enter starting:opacity-0")}
		>
			{state.name === "importing" ? (
				<p role="status" className="flex items-center justify-center gap-2 py-24 text-muted">
					<Spinner size="sm" color="current" aria-hidden />
					<Trans>Importing it into your new resume…</Trans>
				</p>
			) : state.name === "busy" ? (
				<Progress file={state.file} step={state.step} />
			) : state.name === "done" ? (
				<Result
					result={state.result}
					file={state.file}
					onFix={() => void fix(state.file)}
					onReset={() => setState({ name: "idle" })}
				/>
			) : (
				<Idle error={state.error} posting={posting} onPosting={setPosting} onFile={(file) => void check(file)} />
			)}
		</div>
	);
}

async function fetchSample() {
	try {
		const res = await fetch(SAMPLE.url);
		return res.ok ? await res.blob() : null;
	} catch {
		return null;
	}
}

type IdleProps = {
	error?: string | undefined;
	posting: string;
	onPosting: (value: string) => void;
	onFile: (file: File) => void;
};

function Idle({ error, posting, onPosting, onFile }: IdleProps) {
	const id = useId();
	const [sampleError, setSampleError] = useState<string>();

	const sample = async () => {
		setSampleError(undefined);
		const blob = await fetchSample();
		if (blob) onFile(new File([blob], SAMPLE.name, { type: "application/pdf" }));
		else setSampleError(t`Couldn't load the sample file. Try again.`);
	};

	const drop = async ({ items }: DropEvent) => {
		const item = items.find(isFileDropItem);
		const file = await item?.getFile();
		if (file) onFile(file);
	};

	const failure = error ?? sampleError;

	return (
		<div className="mx-auto grid w-full max-w-[640px] gap-6 px-4 py-16 sm:py-20">
			<div className="grid justify-items-center gap-3 text-center">
				<h1 className="text-[34px] leading-10 font-semibold tracking-tight sm:text-[44px] sm:leading-[48px]">
					<Trans>Can software read your resume?</Trans>
				</h1>
				<p className="max-w-[520px] text-base leading-[25px] text-muted">
					<Trans>
						Upload a PDF and see the text an applicant tracking system extracts: what's missing, what's out of order,
						and how to fix it. Free, no account needed.
					</Trans>
				</p>
			</div>

			<div className="grid gap-1">
				<DropZone>
					<DropZone.Area onDrop={(event) => void drop(event)}>
						<DropZone.Icon>
							<Icon name="file-arrow-up" size={28} />
						</DropZone.Icon>
						<DropZone.Label>
							<Trans>Drop your PDF here</Trans>
						</DropZone.Label>
						<DropZone.Description>
							<Trans>Up to 25 MB · checked in your browser, never uploaded</Trans>
						</DropZone.Description>
						<DropZone.Trigger>
							<Trans>Choose a file</Trans>
						</DropZone.Trigger>
					</DropZone.Area>
					<DropZone.Input
						accept="application/pdf,.pdf"
						onSelect={(files) => {
							const file = files[0];
							if (file) onFile(file);
						}}
					/>
				</DropZone>
				<Button variant="ghost" className="justify-self-center" onPress={() => void sample()}>
					<Trans>Check a sample file</Trans>
				</Button>
			</div>

			{failure && (
				<Alert status="danger">
					<Alert.Indicator>
						<Icon name="warning-circle" />
					</Alert.Indicator>
					<Alert.Content>
						<Alert.Description>{failure}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}

			<TextField fullWidth value={posting} onChange={onPosting}>
				<Label>
					<Trans>
						Job posting <span className="font-normal text-muted">· optional, adds a keyword match</span>
					</Trans>
				</Label>
				<TextArea
					rows={3}
					maxLength={MAX_POSTING}
					placeholder={t`Paste the posting to see which of its terms your resume already has.`}
				/>
			</TextField>

			<section aria-labelledby={`${id}-checks`} className="mt-8 grid gap-4">
				<div className="grid gap-1.5">
					<h2 id={`${id}-checks`} className="text-[22px] leading-7 font-semibold tracking-tight">
						<Trans>What it checks</Trans>
					</h2>
					<p className="text-sm leading-[21px] text-muted">
						<Trans>
							Applicant tracking systems turn your PDF into plain text before anyone reads it. The checker does the
							same, with the PDF.js library in your browser, then scores how much of your resume survives: 0 to 100,
							from how reliably the text comes out, not from your chances of getting the job.
						</Trans>
					</p>
				</div>
				<dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
					{checkedCategories.map((category) => (
						<div key={category} className="grid gap-0.5">
							<dt className="text-sm font-semibold">{getPdfCategoryLabel(category)}</dt>
							<dd className="text-[13px] leading-[19px] text-muted">{getPdfCategoryDescription(category)}</dd>
						</div>
					))}
				</dl>
			</section>
		</div>
	);
}

const checkedCategories: PdfCategory[] = ["parseability", "layout", "sections", "contact", "dates", "content"];

function Progress({ file, step }: { file: File; step: number }) {
	const steps = [t`Opening the file`, t`Reading the text`, t`Checking layout and content`];
	return (
		<div className="grid place-items-center px-4 py-24">
			<div role="status" className="grid w-full max-w-[420px] gap-3.5">
				<b className="truncate text-[15px] font-semibold">
					<Trans>Checking {file.name}</Trans>
				</b>
				{steps.map((label, index) => (
					<div
						key={label}
						className={cn("flex items-center gap-2.5 text-sm", index > step ? "text-muted" : "text-foreground")}
					>
						<span className="flex w-5.5 justify-center">
							{index < step ? (
								<Icon name="check" size={20} className={cn(POP_CLASS, "text-accent-soft-foreground")} />
							) : index === step ? (
								<Spinner size="sm" color="current" className={POP_CLASS} aria-hidden />
							) : (
								<span aria-hidden className="size-3 rounded-sm border-[1.5px] border-current" />
							)}
						</span>
						{label}
					</div>
				))}
			</div>
		</div>
	);
}

const verdict = (score: number) =>
	score >= 80 ? t`Reads cleanly` : score >= 50 ? t`Mostly readable` : t`Hard for software to read`;

type Row = { key: string; title: string; count: string; tone: "danger" | "warn" | "accent"; body: React.ReactNode };

/** One row per category with something to fix, worst first, plus the posting's terms when one was pasted. */
function issueRows(report: PdfAtsReport): Row[] {
	const byCategory = new Map<PdfCategory, PdfAtsReport["findings"]>();
	for (const finding of [...report.findings, ...report.tips])
		byCategory.set(finding.category, [...(byCategory.get(finding.category) ?? []), finding]);

	const rows: Row[] = [...byCategory.entries()]
		.map(([category, findings]) => ({
			key: category,
			title: getPdfCategoryLabel(category),
			count: String(findings.length),
			tone: findings.some((finding) => finding.severity === "blocker")
				? ("danger" as const)
				: findings.every((finding) => finding.severity === "tip")
					? ("accent" as const)
					: ("warn" as const),
			body: (
				<ul className="grid gap-2">
					{findings.map((finding) => {
						const message = getPdfFindingMessage(finding.code);
						return (
							<li key={finding.code}>
								<b className="font-medium text-foreground">{message.title}</b> {message.action}
							</li>
						);
					})}
				</ul>
			),
		}))
		.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));

	if (report.jd)
		rows.push({
			key: "posting",
			title: t`Terms from the posting`,
			count: `${report.jd.matchedCount}/${report.jd.totalTerms}`,
			tone: "accent",
			body:
				report.jd.missingTerms.length > 0 ? (
					<Trans>Not found: {report.jd.missingTerms.join(", ")}</Trans>
				) : (
					<Trans>Every term the posting stresses is already there.</Trans>
				),
		});

	return rows;
}

type ResultProps = { result: AtsCheckResult; file: File; onFix: () => void; onReset: () => void };

function Result({ result, file, onFix, onReset }: ResultProps) {
	const { report } = result;
	const rows = issueRows(report);
	const [open, setOpen] = useState<string | null>(rows[0]?.key ?? null);
	const [lens, setLens] = useState<"page" | "text">("page");
	const issues = report.findings.length;

	return (
		<div className="grid min-h-[calc(100svh-5rem)] lg:grid-cols-[440px_minmax(0,1fr)]">
			<aside className="grid content-start gap-4.5 border-separator bg-surface p-6 max-lg:pb-28 lg:border-e">
				<div className="flex items-center gap-4">
					<div
						role="img"
						aria-label={t`Readability score: ${report.score} out of 100`}
						className="grid size-[84px] shrink-0 score-ring-reveal place-items-center rounded-full score-ring"
						style={
							{
								"--ring-value": `${report.score}%`,
								"--ring-color": report.score >= 80 ? "var(--accent)" : "var(--warning)",
							} as CSSProperties
						}
					>
						<span className="grid size-[70px] place-items-center rounded-full bg-surface text-[26px] font-semibold tabular-nums">
							<RollingNumber value={report.score} duration="480ms" />
						</span>
					</div>
					<div className="grid gap-1">
						<b className="text-base font-semibold">{verdict(report.score)}</b>
						<span className="text-[13px] leading-[19px] text-muted">
							{issues > 0 ? (
								<Plural value={issues} one="# issue could cost you a match." other="# issues could cost you a match." />
							) : (
								<Trans>Nothing here should cost you a match.</Trans>
							)}{" "}
							<Trans>The score reflects how reliably text is extracted, not your chances.</Trans>
						</span>
					</div>
				</div>

				{report.document.truncated && (
					<p className="text-xs text-muted">
						<Trans>Only the first {report.document.pageCount} pages were checked.</Trans>
					</p>
				)}

				{rows.length > 0 && (
					<div className="overflow-hidden rounded-xl bg-surface-secondary">
						{rows.map((row, index) => {
							const expanded = open === row.key;
							return (
								<div
									key={row.key}
									style={stagger(index)}
									className={cn(ENTER_CLASS, index > 0 && "border-t border-separator")}
								>
									<button
										type="button"
										aria-expanded={expanded}
										onClick={() => setOpen(expanded ? null : row.key)}
										className="flex h-12 w-full items-center gap-2.5 px-3.5 text-start text-sm font-medium transition-colors duration-quick hover:bg-default"
									>
										<Icon
											name={
												row.key === "content"
													? "pencil-simple"
													: row.tone === "accent"
														? "briefcase"
														: row.tone === "danger"
															? "warning-circle"
															: "warning"
											}
											size={20}
											className={cn(
												row.tone === "danger" && "text-danger-soft-foreground",
												row.tone === "warn" && "text-warning-soft-foreground",
												row.tone === "accent" && "text-accent-soft-foreground",
											)}
										/>
										{row.title}
										<span className="text-xs text-muted">{row.count}</span>
										<Icon
											name="caret-down"
											size={20}
											className={cn(
												"ms-auto text-muted transition-transform duration-standard ease-enter",
												expanded && "rotate-180",
											)}
										/>
									</button>
									<Disclosure isExpanded={expanded}>
										<Disclosure.Content>
											<Disclosure.Body className="px-3.5 ps-11 pb-3.5 text-[13px] leading-[19px] text-muted">
												{row.body}
											</Disclosure.Body>
										</Disclosure.Content>
									</Disclosure>
								</div>
							);
						})}
					</div>
				)}

				<div className="grid gap-2.5 rounded-xl bg-accent-soft p-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:rounded-none max-lg:border-t max-lg:border-separator max-lg:bg-surface max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]">
					<b className="text-[15px] font-semibold max-lg:hidden">
						<Trans>Fix these in a few minutes</Trans>
					</b>
					<span className="text-[13px] leading-[19px] text-muted max-lg:hidden">
						<Trans>Import this file into a free Rezumi. Every issue is waiting for you in Check.</Trans>
					</span>
					<Button className="h-10" onPress={onFix}>
						<Trans>Fix these in the editor</Trans>
					</Button>
				</div>

				<Button variant="ghost" className="w-fit" onPress={onReset}>
					<Trans>Check another file</Trans>
				</Button>
			</aside>

			<section aria-label={t`Your file`} className="grid content-start bg-default">
				<div className="flex justify-center p-4">
					<Tabs selectedKey={lens} onSelectionChange={(key) => setLens(key === "text" ? "text" : "page")}>
						<Tabs.ListContainer>
							<Tabs.List aria-label={t`How to show the file`}>
								<Tabs.Tab id="page">
									<Trans>Original page</Trans>
									<Tabs.Indicator />
								</Tabs.Tab>
								<Tabs.Tab id="text">
									<Trans>As software reads it</Trans>
									<Tabs.Indicator />
								</Tabs.Tab>
							</Tabs.List>
						</Tabs.ListContainer>
					</Tabs>
				</div>
				<div className="grid justify-items-center px-4 pb-10 sm:px-10">
					{/* Both lenses stay mounted, so switching back never re-reads the PDF. The page lens collapses instead of
					    display:none, so the viewer keeps its width for "page-width" scaling even if the switch happens while
					    it is still loading. */}
					<div
						inert={lens !== "page"}
						className={cn(
							"w-full max-w-[612px] bg-white shadow-overlay transition-opacity duration-standard ease-enter",
							lens !== "page" && "h-0 overflow-hidden opacity-0 shadow-none",
						)}
					>
						<Suspense fallback={<Spinner size="md" color="current" className="mx-auto my-24" />}>
							<PdfViewer file={file} className="block w-full" />
						</Suspense>
					</div>
					<pre
						hidden={lens !== "text"}
						className={cn(
							ENTER_CLASS,
							"w-full max-w-[612px] rounded-lg border border-separator bg-overlay px-7 py-6 font-mono text-[13px] leading-[21px] whitespace-pre-wrap",
						)}
					>
						{result.fullText || t`No text could be read from this file.`}
					</pre>
				</div>
			</section>
		</div>
	);
}
