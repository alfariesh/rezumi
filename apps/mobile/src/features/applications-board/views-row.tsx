// The Applications tab's views as a scrollable row under the title (01-desain 2.1; the web's section menu): List,
// Board, Calendar, Insights and Jobs. Views swap in place, with no back stack between them. Jobs is the first view
// on the new design system; Phase 10 moves the others onto this row (they still draw the legacy segmented switch).
import type { ApplicationsView } from "@/routes";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { routes } from "@/routes";
import { Tabs, haptics } from "@/ui";

export const APPLICATIONS_VIEWS = [
	"list",
	"board",
	"calendar",
	"insights",
	"jobs",
] as const satisfies readonly ApplicationsView[];

type ApplicationsViewsRowProps = { current: ApplicationsView };

export function ApplicationsViewsRow({ current }: ApplicationsViewsRowProps) {
	const { t } = useLingui();
	const router = useRouter();
	const labels: Record<ApplicationsView, string> = {
		list: t`List`,
		board: t`Board`,
		calendar: t`Calendar`,
		insights: t`Insights`,
		jobs: t({ message: "Jobs", context: "Job listings to search" }),
	};
	return (
		<Tabs
			value={current}
			onValueChange={(next) => {
				const view = APPLICATIONS_VIEWS.find((value) => value === next);
				if (!view || view === current) return;
				haptics.selection();
				router.replace(routes.applications(view));
			}}
			variant="secondary"
		>
			<Tabs.List className="mx-4" accessibilityLabel={t`Application views`}>
				<Tabs.ScrollView scrollAlign="center">
					<Tabs.Indicator />
					{APPLICATIONS_VIEWS.map((view) => (
						<Tabs.Trigger key={view} value={view} testID={`applications-view-${view}`}>
							<Tabs.Label>{labels[view]}</Tabs.Label>
						</Tabs.Trigger>
					))}
				</Tabs.ScrollView>
			</Tabs.List>
		</Tabs>
	);
}
