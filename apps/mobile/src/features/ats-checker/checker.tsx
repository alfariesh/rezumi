// The public ATS checker on a phone (plans/mobile Phase 08): pick a PDF, the server reads it and keeps nothing, then
// the score, what could cost a match, the original pages and the text as software reads it. "Fix these in the editor"
// imports the same file and opens Check.
import type { AtsResult } from "./check";
import type { IconName, ThemeColor } from "@/ui";
import type { PdfAtsReport, PdfCategory } from "@rezumi/resume/ats-pdf";
import type { DocumentPickerAsset } from "expo-document-picker";
import type { ReactNode } from "react";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { Stack, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { AtsCheckError, MAX_IMPORT_BYTES, runAtsCheck } from "./check";
import { getPdfCategoryLabel, getPdfFindingMessage } from "./messages";
import { OriginalPage } from "./original-page";
import { getServer, useSession } from "@/auth/session";
import { ImportError, importDocument } from "@/features/documents/import-file";
import { routes } from "@/routes";
import {
	Alert,
	Button,
	Card,
	Chip,
	Description,
	Icon,
	Label,
	Screen,
	Segment,
	Separator,
	Spinner,
	Text,
	TextArea,
	TextField,
	Typography,
	space,
	useThemeColor,
} from "@/ui";

type PickedFile = Pick<DocumentPickerAsset, "uri" | "name" | "size" | "mimeType" | "lastModified">;

type State =
	| { name: "idle"; error?: string | undefined }
	| { name: "busy"; file: PickedFile; step: number }
	| { name: "done"; file: PickedFile; result: AtsResult }
	| { name: "importing" };

const MAX_POSTING = 20_000;
// The server sends no progress, so the last step starts once the upload has had a moment.
const ANALYSING_AFTER_MS = 1500;
// How long a "Fix these in the editor" press waits for sign-in before the file is forgotten.
const PENDING_IMPORT_MS = 10 * 60 * 1000;

export function AtsChecker() {
	const { t } = useLingui();
	const router = useRouter();
	const session = useSession();
	const signedIn = session.status === "signed-in";
	const [state, setState] = useState<State>({ name: "idle" });
	const [posting, setPosting] = useState("");
	const abort = useRef<AbortController | null>(null);
	// Fix pressed while signed out: the import continues once sign-in returns here, on the same server, soon after.
	const pendingImport = useRef<{ file: PickedFile; server: string; at: number } | null>(null);
	const reset = () => {
		pendingImport.current = null;
		setState({ name: "idle" });
	};

	useEffect(() => () => abort.current?.abort(), []);

	const check = async (file: PickedFile) => {
		pendingImport.current = null;
		abort.current?.abort();
		const controller = new AbortController();
		abort.current = controller;
		setState({ name: "busy", file, step: 1 });
		const analysing = setTimeout(() => setState({ name: "busy", file, step: 2 }), ANALYSING_AFTER_MS);
		try {
			const result = await runAtsCheck(file.uri, file.name, posting, controller.signal);
			if (!controller.signal.aborted) setState({ name: "done", file, result });
		} catch (error) {
			if (!controller.signal.aborted)
				setState({
					name: "idle",
					error: error instanceof AtsCheckError ? error.message : t`Couldn't read that file. Try again.`,
				});
		} finally {
			clearTimeout(analysing);
		}
	};

	const choose = async () => {
		const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
		const asset = picked.canceled ? undefined : picked.assets[0];
		if (asset) void check(asset);
	};

	const sample = async () => {
		try {
			const target = new File(Paths.cache, "rezumi-sample.pdf");
			const file = await File.downloadFileAsync(`${getServer()}/templates/pdf/atlas.pdf`, target, { idempotent: true });
			void check({ uri: file.uri, name: "Sample resume.pdf", size: file.size, lastModified: Date.now() });
		} catch {
			setState({ name: "idle", error: t`Couldn't load the sample file. Try again.` });
		}
	};

	const cancel = () => {
		abort.current?.abort();
		reset();
	};

	const importAndOpen = async (file: PickedFile) => {
		setState({ name: "importing" });
		const controller = new AbortController();
		abort.current = controller;
		try {
			// Server text extraction, no AI: the same reading the check did, so every issue lines up in Check.
			const imported = await importDocument(file, false, false, controller.signal);
			router.replace(routes.builder(imported.id, "check"));
		} catch (error) {
			if (controller.signal.aborted) return;
			setState({
				name: "idle",
				error: error instanceof ImportError ? error.message : t`Couldn't import the file. Try again from Documents.`,
			});
		}
	};

	const fix = (file: PickedFile) => {
		if (signedIn) return void importAndOpen(file);
		pendingImport.current = { file, server: getServer(), at: Date.now() };
		router.push(routes.signIn());
	};

	// Runs on sign-in and on a server switch: a stale, expired or other-server file is dropped, never imported.
	const resumeImport = useEffectEvent(() => {
		const pending = pendingImport.current;
		if (!pending) return;
		const valid = pending.server === getServer() && Date.now() - pending.at < PENDING_IMPORT_MS;
		if (valid && !signedIn) return;
		pendingImport.current = null;
		if (valid) void importAndOpen(pending.file);
	});
	useEffect(() => {
		resumeImport();
	}, [signedIn, session.server]);

	return (
		<>
			<Stack.Screen options={{ title: state.name === "done" ? t`Report` : t`ATS checker` }} />
			{state.name === "importing" ? (
				<Importing />
			) : state.name === "busy" ? (
				<Progress name={state.file.name} step={state.step} onCancel={cancel} />
			) : state.name === "done" ? (
				<Result
					result={state.result}
					uri={state.file.uri}
					size={state.file.size ?? new File(state.file.uri).size}
					onFix={() => fix(state.file)}
					onReset={reset}
					onBlank={() => router.replace(routes.new())}
				/>
			) : (
				<Idle
					error={state.error}
					posting={posting}
					onPosting={setPosting}
					onChoose={() => void choose()}
					onSample={() => void sample()}
				/>
			)}
		</>
	);
}

type IdleProps = {
	error?: string | undefined;
	posting: string;
	onPosting: (value: string) => void;
	onChoose: () => void;
	onSample: () => void;
};

function Idle({ error, posting, onPosting, onChoose, onSample }: IdleProps) {
	const { t } = useLingui();
	return (
		<Screen edges={["bottom"]}>
			<View className="gap-2">
				<Typography.Heading type="h2">{t`Can software read your resume?`}</Typography.Heading>
				<Typography type="body-sm" className="text-muted">
					{t`Upload a PDF and see the text an applicant tracking system extracts: what's missing, what's out of order, and how to fix it. Free, no account needed.`}
				</Typography>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t`Choose a PDF`}
				accessibilityHint={t`Up to 25 MB · checked on the server and not stored`}
				onPress={onChoose}
				testID="ats-choose"
				className="items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-6 active:bg-surface-secondary"
			>
				<View className="size-12 items-center justify-center rounded-xl bg-accent-soft">
					<Icon name="file-arrow-up" size={24} tone="accent" />
				</View>
				<Typography.Heading type="h6">{t`Choose a PDF`}</Typography.Heading>
				<Text size="xs" tone="muted" className="text-center">
					{t`Up to 25 MB · checked on the server and not stored`}
				</Text>
			</Pressable>
			{error ? (
				<Alert status="danger">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>{error}</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}
			<Button variant="ghost" onPress={onSample}>
				<Button.Label>{t`Check a sample file`}</Button.Label>
			</Button>
			<TextField>
				<Label>{t`Job posting · optional, adds a keyword match`}</Label>
				<TextArea
					value={posting}
					onChangeText={onPosting}
					maxLength={MAX_POSTING}
					numberOfLines={4}
					accessibilityLabel={t`Job posting · optional, adds a keyword match`}
				/>
				<Description>{t`Paste the posting to see which of its terms your resume already has.`}</Description>
			</TextField>
		</Screen>
	);
}

type ProgressProps = { name: string; step: number; onCancel: () => void };

function Progress({ name, step, onCancel }: ProgressProps) {
	const { t } = useLingui();
	const steps = [t`Opening the file`, t`Reading the text`, t`Checking layout and content`];
	return (
		<Screen edges={["bottom"]}>
			<View accessibilityLiveRegion="polite" className="gap-4 pt-2">
				<Typography.Heading type="h4" numberOfLines={2}>{t`Checking ${name}`}</Typography.Heading>
				<Card>
					<Card.Body className="gap-3">
						{/* Step 0, opening, is the local read; it is done once the upload starts. */}
						{steps.map((label, index) => (
							<View key={label} className="min-h-6 flex-row items-center gap-3">
								<View className="size-6 items-center justify-center">
									{index < step ? (
										<Icon name="check-circle" tone="success" />
									) : index === step ? (
										<Spinner size="sm" />
									) : (
										<Icon name="circle" tone="muted" />
									)}
								</View>
								<Text tone={index > step ? "muted" : "default"}>{label}</Text>
							</View>
						))}
					</Card.Body>
				</Card>
				<Button variant="secondary" onPress={onCancel}>
					<Button.Label>{t`Cancel`}</Button.Label>
				</Button>
			</View>
		</Screen>
	);
}

function Importing() {
	const { t } = useLingui();
	return (
		<Screen edges={["bottom"]}>
			<View accessibilityLiveRegion="polite" className="items-center gap-3 px-2 pt-24">
				<Spinner size="lg" />
				<Typography.Heading type="h4" className="text-center">
					{t`Importing it into your new resume…`}
				</Typography.Heading>
				<Typography type="body-sm" className="text-center text-muted">
					{t`The editor opens on Check, which checks the imported resume again.`}
				</Typography>
			</View>
		</Screen>
	);
}

type Tone = "danger" | "warning" | "accent";
type Row = {
	key: string;
	title: string;
	count: string;
	tone: Tone;
	icon: IconName;
	findings: PdfAtsReport["findings"];
};

/** One row per category with something to fix, worst first; the web's `issueRows`. */
export function issueRows(report: PdfAtsReport): Row[] {
	const byCategory = new Map<PdfCategory, PdfAtsReport["findings"]>();
	for (const finding of [...report.findings, ...report.tips])
		byCategory.set(finding.category, [...(byCategory.get(finding.category) ?? []), finding]);
	const rank = { danger: 0, warning: 1, accent: 2 };
	return [...byCategory.entries()]
		.map(([category, findings]) => {
			const tone: Tone = findings.some((finding) => finding.severity === "blocker")
				? "danger"
				: findings.every((finding) => finding.severity === "tip")
					? "accent"
					: "warning";
			const icon: IconName =
				category === "content"
					? "pencil-simple"
					: tone === "danger"
						? "warning-circle"
						: tone === "warning"
							? "warning"
							: "info";
			return {
				key: category,
				title: getPdfCategoryLabel(category),
				count: String(findings.length),
				tone,
				icon,
				findings,
			};
		})
		.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

type ResultProps = {
	result: AtsResult;
	uri: string;
	size: number;
	onFix: () => void;
	onReset: () => void;
	onBlank: () => void;
};

function Result({ result, uri, size, onFix, onReset, onBlank }: ResultProps) {
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	const { report } = result;
	const rows = issueRows(report);
	const [open, setOpen] = useState<string | null>(report.jd ? "posting" : (rows[0]?.key ?? null));
	const [lens, setLens] = useState<"report" | "page" | "text">("report");
	const issues = report.findings.length;
	const verdict =
		report.score >= 80 ? t`Reads cleanly` : report.score >= 50 ? t`Mostly readable` : t`Hard for software to read`;
	const tooLarge = size > MAX_IMPORT_BYTES;
	const megabytes = Math.ceil(size / 1_000_000);
	const toggle = (key: string) => setOpen((current) => (current === key ? null : key));
	const jd = report.jd;
	// The footer sits above the home indicator.
	const footerPadding = { paddingBottom: insets.bottom + space[4] };

	return (
		<View className="flex-1 bg-background">
			<Screen>
				<Card>
					<Card.Body className="flex-row items-center gap-4">
						<ScoreRing score={report.score} />
						<View className="min-w-0 flex-1 gap-1">
							<Typography.Heading type="h5">{verdict}</Typography.Heading>
							<Typography type="body-xs" className="text-muted">
								{`${
									issues > 0
										? plural(issues, {
												one: "# issue could cost you a match.",
												other: "# issues could cost you a match.",
											})
										: t`Nothing here should cost you a match.`
								} ${t`The score reflects how reliably text is extracted, not your chances.`}`}
							</Typography>
						</View>
					</Card.Body>
				</Card>

				{report.document.truncated ? (
					<Alert status="accent">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>{t`Only the first ${report.document.pageCount} pages were checked.`}</Alert.Title>
							<Alert.Description>{t`The rest of the file isn't in this report.`}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<Segment
					accessibilityLabel={t`How to show the file`}
					value={lens}
					onValueChange={setLens}
					options={[
						{ value: "report", label: t`Report` },
						{ value: "page", label: t`Page` },
						{ value: "text", label: t`Text` },
					]}
				/>

				{lens === "report" ? (
					<>
						<Card className="p-0">
							{jd ? (
								<IssueRow
									title={t`Terms from the posting`}
									count={`${jd.matchedCount}/${jd.totalTerms}`}
									icon="list-checks"
									tone="warning"
									expanded={open === "posting"}
									onToggle={() => toggle("posting")}
								>
									{jd.totalTerms === 0 ? (
										<Typography type="body-xs" className="text-muted">
											{t`No specific terms could be pulled out of that job description.`}
										</Typography>
									) : jd.missingTerms.length === 0 ? (
										<Typography type="body-xs" className="text-muted">
											{t`Every term the posting stresses is already there.`}
										</Typography>
									) : (
										<>
											<Text size="xs" weight="semibold" tone="muted">{t`Not found:`}</Text>
											<Terms terms={jd.missingTerms} />
											{jd.matchedTerms.length > 0 ? (
												<>
													<Text size="xs" weight="semibold" tone="muted">{t`Already covered:`}</Text>
													<Terms terms={jd.matchedTerms} covered />
												</>
											) : null}
											<Text size="xs" tone="muted">
												{t`Counted separately from the parse score. Coverage does not predict anything.`}
											</Text>
										</>
									)}
								</IssueRow>
							) : null}
							{rows.map((row, index) => (
								<View key={row.key}>
									{index > 0 || jd ? <Separator /> : null}
									<IssueRow
										title={row.title}
										count={row.key === "content" ? t`${row.count} · Not scored` : row.count}
										icon={row.icon}
										tone={row.tone}
										expanded={open === row.key}
										onToggle={() => toggle(row.key)}
									>
										{row.findings.map((finding) => {
											const message = getPdfFindingMessage(finding.code);
											return (
												<View key={finding.code} className="gap-0.5">
													<Text weight="medium">{message.title}</Text>
													<Typography type="body-xs" className="text-muted">
														{message.action}
													</Typography>
												</View>
											);
										})}
									</IssueRow>
								</View>
							))}
						</Card>
						<Text size="xs" tone="muted" className="px-1 leading-5">
							{t`This measures how faithfully software can extract this file's text. It does not predict whether an application will be rejected, and no tool can.`}
						</Text>
						<Button variant="ghost" onPress={onReset}>
							<Button.Label>{t`Check another file`}</Button.Label>
						</Button>
					</>
				) : lens === "page" ? (
					<OriginalPage uri={uri} />
				) : (
					<View className="gap-2">
						<Text size="xs" weight="semibold" tone="muted" className="px-1">
							{t`As software reads it`}
						</Text>
						<Card className="p-0">
							<ScrollView horizontal>
								<Text mono selectable className="p-4">
									{result.fullText || t`No text could be read from this file.`}
								</Text>
							</ScrollView>
						</Card>
					</View>
				)}
			</Screen>

			<View className="gap-3 border-t border-separator bg-surface px-4 pt-4" style={footerPadding}>
				{tooLarge ? (
					<>
						<Alert status="warning">
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Title>{t`This file is ${megabytes} MB. Imports take files up to 10 MB.`}</Alert.Title>
								<Alert.Description>
									{t`Export a smaller PDF and check it again, or start a blank resume and fix these there.`}
								</Alert.Description>
							</Alert.Content>
						</Alert>
						<View className="flex-row gap-2">
							<Button variant="secondary" className="flex-1" onPress={onReset}>
								<Button.Label>{t`Check another file`}</Button.Label>
							</Button>
							<Button className="flex-1" onPress={onBlank}>
								<Button.Label>{t`Start blank`}</Button.Label>
							</Button>
						</View>
					</>
				) : (
					<Button onPress={onFix}>
						<Button.Label>{t`Fix these in the editor`}</Button.Label>
					</Button>
				)}
			</View>
		</View>
	);
}

type IssueRowProps = {
	title: string;
	count: string;
	icon: IconName;
	tone: ThemeColor;
	expanded: boolean;
	onToggle: () => void;
	children: ReactNode;
};

/** One category of the report: a row that opens to its findings. */
function IssueRow({ title, count, icon, tone, expanded, onToggle, children }: IssueRowProps) {
	return (
		<View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${title}, ${count}`}
				accessibilityState={{ expanded }}
				onPress={onToggle}
				className="min-h-14 flex-row items-center gap-3 px-4 active:bg-surface-secondary"
			>
				<Icon name={icon} tone={tone} />
				<Text weight="medium" className="flex-1">
					{title}
				</Text>
				<Text size="xs" tone="muted" tabular>
					{count}
				</Text>
				<Icon name={expanded ? "caret-down" : "caret-right"} size={16} tone="muted" />
			</Pressable>
			{expanded ? <View className="gap-2 ps-12 pe-4 pb-4">{children}</View> : null}
		</View>
	);
}

function Terms({ terms, covered = false }: { terms: readonly string[]; covered?: boolean }) {
	return (
		<View className="flex-row flex-wrap gap-2">
			{terms.map((term) => (
				<Chip key={term} size="sm" variant={covered ? "soft" : "secondary"} color={covered ? "success" : "default"}>
					<Chip.Label>{term}</Chip.Label>
				</Chip>
			))}
		</View>
	);
}

const RING = { size: 84, stroke: 7 } as const;

function ScoreRing({ score }: { score: number }) {
	const { t } = useLingui();
	const [track, good, fair] = useThemeColor(["default", "success", "warning"]);
	const r = (RING.size - RING.stroke) / 2;
	const circumference = 2 * Math.PI * r;
	const value = Math.min(100, Math.max(0, score));
	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={t`Readability score: ${score} out of 100`}
			className="size-21 items-center justify-center"
		>
			<View className="absolute">
				<Svg width={RING.size} height={RING.size}>
					<Circle cx={RING.size / 2} cy={RING.size / 2} r={r} stroke={track} strokeWidth={RING.stroke} fill="none" />
					<Circle
						cx={RING.size / 2}
						cy={RING.size / 2}
						r={r}
						stroke={score >= 80 ? good : fair}
						strokeWidth={RING.stroke}
						fill="none"
						strokeLinecap="round"
						strokeDasharray={`${circumference} ${circumference}`}
						strokeDashoffset={circumference * (1 - value / 100)}
						rotation={-90}
						origin={`${RING.size / 2}, ${RING.size / 2}`}
					/>
				</Svg>
			</View>
			<Typography.Heading type="h4">{String(score)}</Typography.Heading>
		</View>
	);
}
