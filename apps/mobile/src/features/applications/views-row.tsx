// The Applications tab's sections as a scrollable row under the title (01-desain: All · Jobs · Insights · Offers; the
// web's section menu). All holds List, Board and Calendar behind a segment (`AllViewsSegment`). Sections swap in place,
// with no back stack between them; All reopens the layout used last.
import type { ApplicationsView } from "@/routes";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { create } from "zustand";
import { subscribeIdentity } from "@/auth/session";
import { routes } from "@/routes";
import { Segment, Tabs, haptics } from "@/ui";

export type AllView = "list" | "board" | "calendar";
export type ApplicationsSection = "all" | "jobs" | "insights" | "offers";

const SECTIONS = ["all", "jobs", "insights", "offers"] as const satisfies readonly ApplicationsSection[];

export const sectionOf = (view: ApplicationsView): ApplicationsSection =>
	view === "list" || view === "board" || view === "calendar" ? "all" : view;

/** The All layout used last (this session, per account), so All reopens on Board after visiting Jobs. */
const useLastAll = create<{ view: AllView; set: (view: AllView) => void }>((set) => ({
	view: "list",
	set: (view) => set({ view }),
}));
subscribeIdentity(() => useLastAll.setState({ view: "list" }));

type ApplicationsViewsRowProps = { current: ApplicationsView };

export function ApplicationsViewsRow({ current }: ApplicationsViewsRowProps) {
	const { t } = useLingui();
	const router = useRouter();
	const lastAll = useLastAll((state) => state.view);
	const section = sectionOf(current);
	const labels: Record<ApplicationsSection, string> = {
		all: t({ message: "All", context: "All applications" }),
		jobs: t({ message: "Jobs", context: "Job listings to search" }),
		insights: t`Insights`,
		offers: t`Offers`,
	};
	return (
		<Tabs
			value={section}
			onValueChange={(next) => {
				const picked = SECTIONS.find((value) => value === next);
				if (!picked || picked === section) return;
				haptics.selection();
				router.replace(routes.applications(picked === "all" ? lastAll : picked));
			}}
			variant="secondary"
		>
			<Tabs.List className="mx-4" accessibilityLabel={t`Application views`}>
				<Tabs.ScrollView scrollAlign="center">
					<Tabs.Indicator />
					{SECTIONS.map((value) => (
						<Tabs.Trigger key={value} value={value} testID={`applications-view-${value}`}>
							<Tabs.Label>{labels[value]}</Tabs.Label>
						</Tabs.Trigger>
					))}
				</Tabs.ScrollView>
			</Tabs.List>
		</Tabs>
	);
}

type AllViewsSegmentProps = { current: AllView };

/** List, Board and Calendar inside All. */
export function AllViewsSegment({ current }: AllViewsSegmentProps) {
	const { t } = useLingui();
	const router = useRouter();
	const remember = useLastAll((state) => state.set);
	return (
		<Segment<AllView>
			accessibilityLabel={t`Layout`}
			size="sm"
			className="flex-1"
			value={current}
			options={[
				{ value: "list", label: t`List` },
				{ value: "board", label: t`Board` },
				{ value: "calendar", label: t`Calendar` },
			]}
			onValueChange={(view) => {
				remember(view);
				router.replace(routes.applications(view));
			}}
		/>
	);
}
