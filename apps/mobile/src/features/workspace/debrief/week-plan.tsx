// A light practice plan for the week after a review: ticks kept with the application, and Add to calendar as an
// .ics file through the share sheet (each task at 18:00 on its day, on the person's clock).
import type { Review } from "./review-card";
import type { Application } from "@/features/applications/types";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { buildIcs } from "@rezumi/career/ics";
import { nextEvening } from "@rezumi/career/workspace";
import { ActionButton, Block, Caption, CheckRow } from "../blocks";
import { useTicks } from "../queries";
import { shareText } from "../share";
import { useUserTime } from "@/features/applications/date";
import { showToast } from "@/ui";

type WeekPlanProps = { application: Application; review: Review; now: Date; readOnly: boolean };

export function WeekPlan({ application, review, now, readOnly }: WeekPlanProps) {
	const { t } = useLingui();
	const { timeZone, weekday } = useUserTime();
	const ticks = useTicks(application.id, `week:${review.id}`);
	const rows = review.data.plan.map((row, index) => ({
		...row,
		key: String(index),
		start: nextEvening(row.day, now, timeZone),
	}));
	const done = rows.filter((row) => ticks.ticked.includes(row.key)).length;
	const count = rows.length;
	const minutes = rows.reduce((sum, row) => sum + row.minutes, 0);
	const company = application.company;
	const total = plural(minutes, { one: "# minute in total", other: "# minutes in total" });

	const addToCalendar = async () => {
		const ics = buildIcs(
			rows.map((row) => ({
				uid: `${review.id}-${row.key}`,
				title: row.task,
				start: row.start,
				end: new Date(row.start.getTime() + row.minutes * 60_000),
				description: t`Practice for your ${company} interviews.`,
			})),
		);
		try {
			await shareText(`${company}-practice-week.ics`, ics, "text/calendar", "com.apple.ical.ics");
		} catch {
			showToast({ title: t`Couldn't share the calendar file. Try again.`, variant: "danger" });
		}
	};

	return (
		<Block title={t`This week: make your evidence easier to follow`}>
			<Caption>{t`${done} of ${count} done · ${total}`}</Caption>
			{rows.map((row) => {
				const length = row.minutes;
				const day = weekday(row.start);
				return (
					<CheckRow
						key={row.key}
						label={row.task}
						detail={t`${day} · ${length}m`}
						checked={ticks.ticked.includes(row.key)}
						disabled={readOnly}
						onChange={(on) => ticks.toggle(row.key, on)}
					/>
				);
			})}
			{rows.length > 0 ? (
				<ActionButton icon="calendar-plus" label={t`Add to calendar`} onPress={() => void addToCalendar()} />
			) : null}
			<Caption>{t`Practice priorities, not conclusions about why an employer decided anything.`}</Caption>
		</Block>
	);
}
