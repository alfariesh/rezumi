import type { CheckIssue } from "./messages";
import type { ParsedPdf } from "./use-parsed-pdf";
import type { AtsResult } from "@/features/ats-checker/check";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { getPdfFindingMessage } from "@/features/ats-checker/messages";
import { Alert, Button, Card, Chip, EmptyState, Skeleton, Spinner, Text, Typography } from "@/ui";

type ParserViewProps = {
	pdf: Uint8Array | null;
	issues: readonly CheckIssue[];
	offline: boolean;
	/** The person agreed to send the PDF; kept by the page sheet so switching views doesn't ask again. */
	optedIn: boolean;
	onOptIn: () => void;
	/** The read, owned by the page sheet so its result outlives this view. */
	parsed: ParsedPdf;
	onSelect: (key: string) => void;
};

type NoticeProps = { status: "accent" | "warning" | "danger"; message: string };

function Notice({ status, message }: NoticeProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{message}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

/**
 * "What a parser reads": the text the server's checker gets out of the PDF on the page, in reading order, with the
 * lines behind open issues marked, and what the file-level check found. It runs only after the person agrees.
 */
export function ParserView({ pdf, issues, offline, optedIn, onOptIn, parsed, onSelect }: ParserViewProps) {
	const { t } = useLingui();

	if (!optedIn)
		return (
			<Card className="gap-3">
				<Typography type="body-sm">
					{t`The PDF is checked on the server and not stored. Send this preview to see what software reads.`}
				</Typography>
				<Button isDisabled={offline || !pdf} onPress={onOptIn} testID="parser-opt-in">
					<Button.Label>{t`Read the exported PDF`}</Button.Label>
				</Button>
				{offline ? <Text tone="muted">{t`You're offline. Connect to check a file.`}</Text> : null}
			</Card>
		);

	return (
		<View className="gap-3">
			{offline ? (
				<Notice status="accent" message={t`You're offline. The last PDF check stays here; connect to refresh it.`} />
			) : null}
			{parsed.error ? (
				<View className="gap-2">
					<Notice status="danger" message={parsed.error} />
					<Button variant="secondary" className="self-start" onPress={parsed.retry}>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : null}
			{parsed.pending ? (
				<View className="flex-row items-center gap-3">
					<Spinner size="sm" />
					<Text tone="muted" className="flex-1">{t`Reading the PDF…`}</Text>
					<Button variant="ghost" onPress={parsed.cancel}>
						<Button.Label>{t`Cancel`}</Button.Label>
					</Button>
				</View>
			) : null}
			{parsed.result ? (
				<Parsed value={parsed.result.value} stale={parsed.stale} issues={issues} onSelect={onSelect} />
			) : parsed.pending || !pdf ? (
				<Skeleton variant="none" className="h-96 w-full rounded-2xl" />
			) : null}
		</View>
	);
}

/** The issue whose text shows on a line, such as a link written without https:// or an unreadable date. */
const issueOnLine = (issues: readonly CheckIssue[], line: string) =>
	issues.find((issue) => issue.facts.value.length > 2 && line.includes(issue.facts.value));

type ParsedProps = { value: AtsResult; stale: boolean; issues: readonly CheckIssue[]; onSelect: (key: string) => void };

function Parsed({ value, stale, issues, onSelect }: ParsedProps) {
	const { t } = useLingui();
	const { report, fullText } = value;
	const lines = fullText.split("\n").filter((line) => line.trim());

	return (
		<Card className="gap-3" testID="parser-result">
			{stale ? <Text tone="warning">{t`Previous PDF result. It may not match your current draft.`}</Text> : null}
			<Text size="xs" weight="medium" tone="muted">{t`Extracted from the PDF on the page · reading order`}</Text>
			<Text tabular>
				{plural(report.applicableChecks, {
					one: `${report.passedChecks} of # exported PDF check passes.`,
					other: `${report.passedChecks} of # exported PDF checks pass.`,
				})}
			</Text>
			{report.document.truncated ? (
				<Notice status="warning" message={t`Only the first 30 pages were checked.`} />
			) : null}
			{lines.length === 0 ? (
				<EmptyState kind="inline" title={t`This PDF has no text layer, so a parser reads nothing from it.`} />
			) : (
				<View className="gap-1">
					{lines.map((line, index) => {
						const issue = issueOnLine(issues, line);
						return (
							<View key={`${index}:${line}`} className="flex-row flex-wrap items-center gap-2">
								<Text mono selectable size="xs" tone={issue ? "warning" : "muted"} className="shrink">
									{line}
								</Text>
								{issue ? (
									<Button variant="ghost" size="sm" onPress={() => onSelect(issue.key)}>
										<Chip size="sm" variant="soft" color={issue.tone}>
											<Chip.Label>{t`issue ${issue.number}`}</Chip.Label>
										</Chip>
									</Button>
								) : null}
							</View>
						);
					})}
				</View>
			)}
			{report.findings.map((finding, index) => {
				const message = getPdfFindingMessage(finding.code);
				return (
					<View key={`${finding.code}:${index}`} className="gap-1">
						<Text weight="medium">{message.title}</Text>
						<Typography type="body-sm" className="text-muted">
							{message.action}
						</Typography>
					</View>
				);
			})}
		</Card>
	);
}
