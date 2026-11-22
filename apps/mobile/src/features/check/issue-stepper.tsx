import type { CheckIssue } from "./messages";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Button, Icon, IconButton, Text, Typography } from "@/ui";

type IssueStepperProps = {
	issues: readonly CheckIssue[];
	issue: CheckIssue;
	locked: boolean;
	onSelect: (key: string | null) => void;
	onFix: (issue: CheckIssue) => void;
};

/** With an issue picked on the page: "Issue n of m" with ‹ › to step through them, and its fix, so fixing never needs the list. */
export function IssueStepper({ issues, issue, locked, onSelect, onFix }: IssueStepperProps) {
	const { t } = useLingui();
	const index = issues.findIndex((entry) => entry.key === issue.key);
	const go = (step: number) => onSelect(issues[(index + step + issues.length) % issues.length]?.key ?? null);
	const applies = issue.fix.kind === "apply";

	return (
		<View className="gap-3 rounded-2xl bg-surface-secondary p-3" testID="issue-stepper">
			<View className="flex-row items-center gap-1">
				<IconButton icon="x" label={t`Close`} onPress={() => onSelect(null)} />
				<Text weight="semibold" tabular className="flex-1 text-center">
					{t`Issue ${issue.number} of ${issues.length}`}
				</Text>
				<IconButton icon="caret-left" label={t`Previous issue`} onPress={() => go(-1)} />
				<IconButton icon="caret-right" label={t`Next issue`} onPress={() => go(1)} />
			</View>
			<Typography.Heading type="h6">{issue.title}</Typography.Heading>
			<Typography type="body-sm" className="text-muted">
				{issue.body}
			</Typography>
			<Button isDisabled={locked && applies} onPress={() => onFix(issue)}>
				<Icon name={issue.fix.kind === "apply" ? issue.fix.icon : "pencil-simple"} size={20} tone="accent-foreground" />
				<Button.Label numberOfLines={1}>{issue.fixLabel}</Button.Label>
			</Button>
		</View>
	);
}
