import type { AtsReport } from "@rezumi/resume/ats";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Card, Icon, ProgressCircle, Text, Typography } from "@/ui";

type ScoreCardProps = { report: AtsReport };

/** The readability ring (accent, or warning below 80), the verdict and what the score counts. */
export function ScoreCard({ report }: ScoreCardProps) {
	const { t } = useLingui();
	const { score, passedRules, totalRules } = report;
	const open = report.findings.length;
	const verdict = score >= 80 ? t`Reads cleanly` : score >= 50 ? t`Mostly readable` : t`Hard for software to read`;

	return (
		<Card className="flex-row items-center gap-4" testID="check-score">
			<ProgressCircle
				accessibilityLabel={t`Readability score: ${score} out of 100`}
				value={score}
				size="lg"
				color={score >= 80 ? "accent" : "warning"}
			>
				{String(score)}
			</ProgressCircle>
			<View className="min-w-0 flex-1 gap-1">
				<Typography.Heading type="h6">{verdict}</Typography.Heading>
				<Typography type="body-sm" className="text-muted">
					{`${t`${passedRules} of ${totalRules} checks pass.`} ${
						open > 0 ? plural(open, { one: "# thing to review.", other: "# things to review." }) : t`Nothing to review.`
					}`}
				</Typography>
				<View className="flex-row items-center gap-1">
					<Icon name="lightning" size={16} tone="muted" />
					<Text size="xs" tone="muted">{t`Live · updates as you edit`}</Text>
				</View>
			</View>
		</Card>
	);
}
