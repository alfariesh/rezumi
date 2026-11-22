import type { CheckIssue } from "./messages";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { getCategoryName } from "./messages";
import { Button, Chip, Icon, Text, Typography, cx } from "@/ui";

type IssueCardProps = {
	issue: CheckIssue;
	selected: boolean;
	locked: boolean;
	onFix: (issue: CheckIssue) => void;
	onShowOnPage: (issue: CheckIssue) => void;
	onIgnore: (issue: CheckIssue) => void;
};

const RING = { warning: "border-warning", danger: "border-danger" } as const;

/** A numbered card: category, title, a plain explanation, the fix, Show on page and Ignore (or Keep). */
export function IssueCard({ issue, selected, locked, onFix, onShowOnPage, onIgnore }: IssueCardProps) {
	const { t } = useLingui();
	const applies = issue.fix.kind === "apply";

	return (
		<View
			testID={`issue-${issue.key}`}
			className={cx(
				"flex-row gap-3 rounded-2xl border-2 bg-surface-secondary p-3",
				selected ? RING[issue.tone] : "border-transparent",
			)}
		>
			{/* The number matches the pin on the page; its colour is the issue's severity. */}
			<Chip
				size="sm"
				variant="soft"
				color={issue.tone}
				className="min-w-7 self-start"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<Chip.Label>{String(issue.number)}</Chip.Label>
			</Chip>
			<View className="min-w-0 flex-1 gap-3">
				<View className="gap-1" accessible accessibilityLabel={`${t`Issue ${issue.number}:`} ${issue.title}`}>
					<Text size="xs" tone="muted">
						{getCategoryName(issue.category)}
					</Text>
					<Typography.Heading type="h6">{issue.title}</Typography.Heading>
					<Typography type="body-sm" className="text-muted">
						{issue.body}
					</Typography>
				</View>
				<View className="flex-row flex-wrap gap-2">
					<Button
						variant={applies && selected ? "primary" : "secondary"}
						isDisabled={locked && applies}
						onPress={() => onFix(issue)}
						testID={`issue-fix-${issue.key}`}
					>
						<Icon name={issue.fix.kind === "apply" ? issue.fix.icon : "pencil-simple"} size={16} />
						<Button.Label numberOfLines={1}>{issue.fixLabel}</Button.Label>
					</Button>
					{issue.target ? (
						<Button variant="ghost" onPress={() => onShowOnPage(issue)}>
							<Button.Label>{t`Show on page`}</Button.Label>
						</Button>
					) : null}
					<Button variant="ghost" isDisabled={locked} onPress={() => onIgnore(issue)}>
						<Button.Label>{issue.keepLabel ? t`Keep` : t`Ignore`}</Button.Label>
					</Button>
				</View>
			</View>
		</View>
	);
}
