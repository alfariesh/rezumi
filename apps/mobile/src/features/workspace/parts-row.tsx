// The seven parts as a scrollable tab row under the bar, each with its badge: time to the next round within a week
// (warning in its last hour), a message waiting for a decision, the number of saved items.
import type { SavedItem } from "./queries";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import type { WorkspaceTab } from "@rezumi/schema/career";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { minutesUntil } from "@rezumi/career/workspace";
import { WORKSPACE_TABS } from "@rezumi/schema/career";
import { partLabel } from "./working";
import { Chip, Tabs, haptics } from "@/ui";

type Badge = { text: string; label: string; color: "warning" | "accent" | "default" };

/** The badge after each part's name, if any. */
export function partBadges(saved: SavedItem[] | undefined, interview: InterviewTimelineEntry | undefined, now: Date) {
	const badges: Partial<Record<WorkspaceTab, Badge>> = {};
	const minutes = interview ? minutesUntil(new Date(interview.at), now) : null;
	if (minutes !== null && minutes > 0 && minutes < 7 * 24 * 60) {
		const hours = Math.round(minutes / 60);
		badges.prepare =
			minutes <= 60
				? {
						text: plural(minutes, { one: "# min", other: "# min" }),
						label: plural(minutes, { one: "Starts in # minute", other: "Starts in # minutes" }),
						color: "warning",
					}
				: {
						text: plural(hours, { one: "# h", other: "# h" }),
						label: plural(hours, { one: "Starts in # hour", other: "Starts in # hours" }),
						color: "default",
					};
	}
	// Messages shows the newest read message: it waits for a decision while its changes aren't applied.
	const newest = saved?.find((item) => item.data.kind === "reply");
	if (newest?.data.kind === "reply" && newest.data.changes.length > 0 && !newest.data.applied)
		badges.messages = {
			text: "1",
			label: plural(1, { one: "# message waiting", other: "# messages waiting" }),
			color: "accent",
		};
	const count = saved?.length ?? 0;
	if (count > 0)
		badges.saved = { text: String(count), label: plural(count, { one: "# item", other: "# items" }), color: "default" };
	return badges;
}

type PartsRowProps = {
	current: WorkspaceTab;
	badges: Partial<Record<WorkspaceTab, Badge>>;
	onChange: (tab: WorkspaceTab) => void;
};

export function PartsRow({ current, badges, onChange }: PartsRowProps) {
	const { t } = useLingui();
	return (
		<Tabs
			value={current}
			onValueChange={(next) => {
				const picked = WORKSPACE_TABS.find((value) => value === next);
				if (!picked || picked === current) return;
				haptics.selection();
				onChange(picked);
			}}
			variant="secondary"
		>
			<Tabs.List className="mx-4" accessibilityLabel={t`Workspace parts`}>
				<Tabs.ScrollView scrollAlign="center">
					<Tabs.Indicator />
					{WORKSPACE_TABS.map((value) => {
						const badge = badges[value];
						const name = partLabel(value);
						return (
							<Tabs.Trigger
								key={value}
								value={value}
								testID={`workspace-part-${value}`}
								accessibilityLabel={badge ? `${name}, ${badge.label}` : name}
							>
								<Tabs.Label>{name}</Tabs.Label>
								{badge ? (
									<Chip size="sm" variant="soft" color={badge.color} className="ms-1.5">
										<Chip.Label>{badge.text}</Chip.Label>
									</Chip>
								) : null}
							</Tabs.Trigger>
						);
					})}
				</Tabs.ScrollView>
			</Tabs.List>
		</Tabs>
	);
}
