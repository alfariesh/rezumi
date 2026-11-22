// Heard back and the median wait for a first reply, side by side (the web's KPI group). Each figure reads as one
// element: its name, value and what it counts.
import type { InsightsFigures } from "./use-insights";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Card, Text, Typography } from "@/ui";

type ReplyFiguresProps = { outcomes: InsightsFigures["outcomes"]; locale: string };

/** Heard back and the median wait for a first reply, side by side. */
export function ReplyFigures({ outcomes, locale }: ReplyFiguresProps) {
	const { t } = useLingui();
	const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
		outcomes.sent ? outcomes.heardBack / outcomes.sent : 0,
	);
	const median = outcomes.medianDaysToReply;
	const wait = median === null ? null : plural(Math.round(median), { one: "# day", other: "# days" });
	return (
		<View className="flex-row gap-4">
			<Figure
				label={t`Heard back`}
				value={share}
				detail={t`${outcomes.heardBack} of ${outcomes.sent} sent`}
				testID="insights-heard-back"
			/>
			<Figure
				label={t`Median to first reply`}
				value={wait ?? "—"}
				detail={wait === null ? t`No replies yet` : undefined}
				testID="insights-median"
			/>
		</View>
	);
}

type FigureProps = { label: string; value: string; detail?: string | undefined; testID: string };

function Figure({ label, value, detail, testID }: FigureProps) {
	return (
		<Card className="flex-1">
			<Card.Body
				accessible
				accessibilityLabel={[label, value === "—" ? undefined : value, detail].filter(Boolean).join(", ")}
				className="gap-1"
				testID={testID}
			>
				<Text size="xs" weight="semibold" tone="muted">
					{label}
				</Text>
				<Typography.Heading type="h3">{value}</Typography.Heading>
				{detail ? (
					<Text size="xs" tone="muted">
						{detail}
					</Text>
				) : null}
			</Card.Body>
		</Card>
	);
}
