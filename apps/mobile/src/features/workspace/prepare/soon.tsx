// W7 / W21, from 10 minutes before until the end: a short checklist that works without AI or new research, the
// opening from the briefing, and Rehearse aloud.
import type { WorkspacePartProps } from "../part";
import type { Briefing } from "./briefing";
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { minutesUntil } from "@rezumi/career/workspace";
import { formatList } from "@rezumi/utils/locale";
import { ActionButton, Actions, Block, Caption, CheckRow } from "../blocks";
import { useTicks } from "../queries";
import { BriefingSheet } from "./briefing";
import { getInterviewKindLabel } from "@/features/applications/stages";
import { Typography } from "@/ui";

type SoonProps = {
	application: Application;
	interview: InterviewTimelineEntry;
	briefing: Briefing | undefined;
	now: Date;
	go: WorkspacePartProps["go"];
};

export function Soon({ application, interview, briefing, now, go }: SoonProps) {
	const { t, i18n } = useLingui();
	const ticks = useTicks(application.id, `now:${interview.id}`);
	const [reading, setReading] = useState(false);
	const minutes = minutesUntil(new Date(interview.at), now);
	const names = interview.participants.map((person) => person.name.split(" ")[0] ?? person.name);
	const heading =
		minutes > 0
			? plural(minutes, { one: "Starts in # minute", other: "Starts in # minutes" })
			: minutes === 0
				? t`Starts now`
				: plural(-minutes, { one: "Started # minute ago", other: "Started # minutes ago" });
	const who = [getInterviewKindLabel(interview.kind), formatList(i18n.locale, names)].filter(Boolean).join(" · ");
	const rows = [
		{ title: t`Check the details`, short: t`Time, link, who, what you sent` },
		{ title: t`Your two-minute introduction`, short: t`Focus, experience, why this role` },
		{ title: t`Pick two examples`, short: t`Situation, action, result` },
		{ title: t`Questions to ask`, short: t`Success at 90 days · next step` },
	];

	return (
		<View className="gap-3" testID="prepare-soon">
			<View className="rounded-2xl bg-warning-soft p-4">
				<Typography.Heading type="h4" accessibilityRole="header" className="text-warning-soft-foreground">
					{heading}
				</Typography.Heading>
			</View>
			{who ? (
				<Typography type="body-sm" color="muted">
					{who}
				</Typography>
			) : null}
			<Caption>{t`Works without AI or new research`}</Caption>
			<Block>
				{rows.map((row, index) => (
					<CheckRow
						key={row.title}
						label={row.title}
						detail={row.short}
						checked={ticks.ticked.includes(String(index))}
						onChange={(on) => ticks.toggle(String(index), on)}
					/>
				))}
			</Block>
			{briefing?.data.opening ? (
				<Block title={t`Your opening`}>
					<Typography type="body-sm" className="italic">{`“${briefing.data.opening}”`}</Typography>
				</Block>
			) : null}
			<Actions>
				{briefing ? <ActionButton size="md" label={t`Briefing`} onPress={() => setReading(true)} /> : null}
				<ActionButton
					variant="primary"
					size="md"
					icon="microphone"
					label={t`Rehearse aloud`}
					onPress={() => go("practise", { speak: true })}
				/>
			</Actions>
			{briefing ? <BriefingSheet briefing={briefing} isOpen={reading} onOpenChange={setReading} /> : null}
		</View>
	);
}
