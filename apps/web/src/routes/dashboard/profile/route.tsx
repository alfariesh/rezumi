import type { SectionNavItem } from "@/components/layout/section-layout";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SectionLayout } from "@/components/layout/section-layout";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/profile")({
	component: ProfileLayout,
});

/**
 * The Profile: the person's details and career, which new resumes, letters and the portfolio start from, then the
 * facts, stories and preferences the coach works from. The section's menu on the left; each page has its own header.
 */
function ProfileLayout() {
	const facts = useQuery(orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } }));
	const stories = useQuery(orpc.career.stories.queryOptions({ input: { applicationId: null } }));

	const items: SectionNavItem[] = [
		{
			link: { to: "/dashboard/profile" },
			match: { to: "/dashboard/profile", fuzzy: false },
			icon: "user-circle",
			label: t({ message: "Details", context: "Profile page: your name, photo, contact details and links" }),
		},
		{
			link: { to: "/dashboard/profile/career" },
			match: { to: "/dashboard/profile/career", fuzzy: true },
			icon: "briefcase",
			label: t`Career`,
		},
		{
			link: { to: "/dashboard/profile/facts" },
			match: { to: "/dashboard/profile/facts", fuzzy: true },
			icon: "list-checks",
			label: t`Facts`,
			count: facts.data?.filter((fact) => fact.status !== "forgotten").length,
		},
		{
			link: { to: "/dashboard/profile/stories/{-$storyId}", params: { storyId: undefined } },
			match: { to: "/dashboard/profile/stories", fuzzy: true },
			icon: "book-open",
			label: t`Stories`,
			count: stories.data?.length,
		},
		{
			link: { to: "/dashboard/profile/preferences" },
			match: { to: "/dashboard/profile/preferences", fuzzy: true },
			icon: "sliders-horizontal",
			label: t({
				message: "Preferences",
				context: "Career preferences: the roles, places, pay and ways of working you want",
			}),
		},
	];

	return (
		<SectionLayout title={t`Profile`} items={items}>
			<Outlet />
		</SectionLayout>
	);
}
