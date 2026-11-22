// Insights' cards (the web's insights-view.tsx): how far applications get, replies, tailored against base resume,
// sending pace and sources. Each chart has one screen-reader summary; bars read as name and count.
import type { InsightsFigures } from "./use-insights";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { getStageLabel } from "@/features/applications/stages";
import { Card, EmptyState, Typography, cx } from "@/ui";
import { BarList } from "@/ui";
import { ColumnChart } from "@/ui";

type InsightCardProps = {
	title: string;
	note?: string | undefined;
	className?: string | undefined;
	children: ReactNode;
};

export function InsightCard({ title, note, className, children }: InsightCardProps) {
	return (
		<Card className={cx(className)}>
			<Card.Body className="gap-3">
				<View className="gap-0.5">
					<Typography.Heading type="h6" accessibilityRole="header">
						{title}
					</Typography.Heading>
					{note ? (
						<Typography type="body-xs" color="muted">
							{note}
						</Typography>
					) : null}
				</View>
				{children}
			</Card.Body>
		</Card>
	);
}

type OutcomesProps = { outcomes: InsightsFigures["outcomes"] };

export function FunnelCard({ outcomes }: OutcomesProps) {
	const { t } = useLingui();
	return (
		<InsightCard
			title={t`How far applications get`}
			note={t`Counts every application that reached each stage, including ones now closed.`}
		>
			<BarList
				items={outcomes.funnel.map((row) => ({
					key: row.status,
					label: getStageLabel(row.status),
					value: row.reached,
					stage: row.status,
				}))}
			/>
		</InsightCard>
	);
}

/** Replies to applications sent with a resume made for the job, against those sent with another one. */
export function TailoredCard({ outcomes }: OutcomesProps) {
	const { t } = useLingui();
	const { tailored, base } = outcomes;
	if (tailored.sent + base.sent === 0) return null;
	return (
		<InsightCard title={t`Tailored vs. base resume`}>
			<Typography type="body-sm" color="muted">
				{t`${tailored.replied} of ${tailored.sent} tailored applications got a reply; ${base.replied} of ${base.sent} sent with another resume.`}
				{tailored.sent + base.sent < 10 ? ` ${t`Small numbers, but worth noticing.`}` : ""}
			</Typography>
		</InsightCard>
	);
}

type WeeklyCardProps = { timeline: InsightsFigures["timeline"]; locale: string; className?: string | undefined };

/** Applications sent per week over the last eight weeks, each column under its week's first day. */
export function WeeklyCard({ timeline, locale, className }: WeeklyCardProps) {
	const { t } = useLingui();
	const day = (start: string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(new Date(`${start}T00:00:00Z`));
	const summary = timeline.map((week) => `${day(week.start, { month: "short", day: "numeric" })}: ${week.count}`);
	return (
		<InsightCard
			title={t`Applications over time`}
			note={t`Applications sent per week (last 8 weeks)`}
			className={className}
		>
			<ColumnChart
				data={timeline.map((week) => ({
					label: day(week.start, { month: "numeric", day: "numeric" }),
					value: week.count,
				}))}
				accessibilityLabel={t`Applications sent per week: ${summary.join(", ")}`}
				testID="insights-weekly"
			/>
		</InsightCard>
	);
}

type SourcesCardProps = { sources: InsightsFigures["sources"]; className?: string | undefined };

export function SourcesCard({ sources, className }: SourcesCardProps) {
	const { t } = useLingui();
	return (
		<InsightCard title={t`Where applications come from`} note={t`Count by source`} className={className}>
			{sources.length === 0 ? (
				<EmptyState kind="inline" title={t`No source data yet.`} />
			) : (
				<BarList items={sources.map((row) => ({ key: row.source, label: row.source, value: row.count }))} />
			)}
		</InsightCard>
	);
}
