import type { CheckIssue } from "./messages";
import type { CheckResult } from "./use-check";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { ATS_CATEGORIES } from "@rezumi/resume/ats";
import { CheckSection } from "./check-section";
import { IssueCard } from "./issue-card";
import { getCategoryDescription, getCategoryName } from "./messages";
import { Alert, Button, Icon, ListRow, ListSection, Text, Typography } from "@/ui";

type IssuesTabProps = {
	check: CheckResult;
	selected: string | null;
	locked: boolean;
	onFix: (issue: CheckIssue) => void;
	onShowOnPage: (issue: CheckIssue) => void;
	onIgnore: (issue: CheckIssue) => void;
	onRestoreIgnored: () => void;
	/** Opens the page on "What a parser reads", which checks the exported PDF. */
	onCheckPdf: () => void;
};

/** Issues: the numbered cards, the checks by category, the exported-PDF check and what the score means. */
export function IssuesTab(props: IssuesTabProps) {
	const { check, selected, locked } = props;
	const { t } = useLingui();
	const { report, issues } = check;
	const categories = ATS_CATEGORIES.filter((category) => report.categories[category].total > 0);

	return (
		<View className="gap-6">
			<CheckSection icon="list-checks" title={t`Issues`} testID="check-issues">
				{issues.length === 0 ? (
					<Alert status="success">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>{t`Nothing to fix.`}</Alert.Title>
							<Alert.Description>{t`Every check passes.`}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : (
					issues.map((issue) => (
						<IssueCard
							key={issue.key}
							issue={issue}
							selected={selected === issue.key}
							locked={locked}
							onFix={props.onFix}
							onShowOnPage={props.onShowOnPage}
							onIgnore={props.onIgnore}
						/>
					))
				)}
			</CheckSection>

			<ListSection title={t`Checks by category`}>
				{categories.map((category) => {
					const { total, passed } = report.categories[category];
					const failing = total - passed;
					return (
						<ListRow
							key={category}
							title={getCategoryName(category)}
							description={getCategoryDescription(category)}
							leading={
								<Icon
									name={failing > 0 ? "warning-circle" : "check-circle"}
									tone={failing > 0 ? "warning" : "accent"}
								/>
							}
							trailing={
								<Text size="xs" tone="muted" tabular>
									{failing > 0
										? plural(failing, { one: "# to review", other: "# to review" })
										: t`${passed} of ${total}`}
								</Text>
							}
						/>
					);
				})}
			</ListSection>

			<Button variant="ghost" className="self-start" onPress={props.onCheckPdf} testID="check-pdf">
				<Icon name="file-pdf" size={20} />
				<Button.Label>{t`Also check the exported PDF`}</Button.Label>
			</Button>

			<View className="gap-2 px-1">
				<Typography type="body-xs" className="text-muted">
					{t`The score counts how reliably software reads your resume. It doesn't predict whether you'll be shortlisted.`}
				</Typography>
				{report.ignored.length > 0 ? (
					<View className="flex-row flex-wrap items-center gap-2">
						<Text size="xs" tone="muted">
							{plural(report.ignored.length, { one: "# issue is ignored.", other: "# issues are ignored." })}
						</Text>
						<Button variant="tertiary" size="sm" isDisabled={locked} onPress={props.onRestoreIgnored}>
							<Button.Label>{t`Show them again`}</Button.Label>
						</Button>
					</View>
				) : null}
			</View>
		</View>
	);
}
