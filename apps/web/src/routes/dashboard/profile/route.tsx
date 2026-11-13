import type { IconName } from "@rezumi/ui/components/icon";
import { Chip, Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/profile")({
	component: ProfileLayout,
});

type Tab = {
	to:
		| "/dashboard/profile"
		| "/dashboard/profile/facts"
		| "/dashboard/profile/stories/{-$storyId}"
		| "/dashboard/profile/preferences";
	match: string;
	/** Details & career is the Profile's own address, so it matches that exactly; the others match their section. */
	fuzzy: boolean;
	icon: IconName;
	label: string;
	count?: number | undefined;
};

/**
 * The Profile: the person's details and career, which new resumes, letters and the portfolio start from, then the
 * facts, stories and preferences the coach works from. Tabs under the title.
 */
function ProfileLayout() {
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	const facts = useQuery(orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } }));
	const stories = useQuery(orpc.career.stories.queryOptions({ input: { applicationId: null } }));
	const tabs: Tab[] = [
		{
			to: "/dashboard/profile",
			match: "/dashboard/profile",
			fuzzy: false,
			icon: "user-circle",
			label: t`Details & career`,
		},
		{
			to: "/dashboard/profile/facts",
			match: "/dashboard/profile/facts",
			fuzzy: true,
			icon: "list-checks",
			label: t`Facts`,
			count: facts.data?.filter((fact) => fact.status !== "forgotten").length,
		},
		{
			to: "/dashboard/profile/stories/{-$storyId}",
			match: "/dashboard/profile/stories",
			fuzzy: true,
			icon: "book-open",
			label: t`Stories`,
			count: stories.data?.length,
		},
		{
			to: "/dashboard/profile/preferences",
			match: "/dashboard/profile/preferences",
			fuzzy: true,
			icon: "sliders-horizontal",
			label: t({
				message: "Preferences",
				context: "Career preferences: the roles, places, pay and ways of working you want",
			}),
		},
	];

	const selected = tabs.find((tab) => matchRoute({ to: tab.match, fuzzy: tab.fuzzy }));

	return (
		<Page>
			{/* Named for the page transition: switching tabs keeps the title and tabs in place while the tab's page fades
			    (index.css). Leaving for another page, they fade with the page. */}
			<div className="grid [view-transition-name:profile-header]">
				<PageHeader
					title={t`Profile`}
					description={
						<Trans>
							Your details and career, kept in one place. New resumes, letters and your portfolio start from here.
						</Trans>
					}
				/>
			</div>
			<Tabs
				selectedKey={selected?.match ?? ""}
				onSelectionChange={(key) => {
					const next = tabs.find((tab) => tab.match === key);
					if (next) void navigate({ to: next.to });
				}}
				className="[view-transition-name:profile-nav]"
			>
				<Tabs.ListContainer className="w-fit max-w-full overflow-x-auto">
					<Tabs.List aria-label={t`Profile`}>
						{tabs.map((tab, index) => (
							<Tabs.Tab key={tab.match} id={tab.match} className="w-auto flex-none gap-2 px-4">
								{index > 0 && <Tabs.Separator />}
								<Icon name={tab.icon} size={18} className="hidden sm:block" />
								{tab.label}
								{tab.count !== undefined && (
									<Chip size="sm" variant="soft" className="hidden tabular-nums sm:inline-flex">
										{tab.count}
									</Chip>
								)}
								<Tabs.Indicator />
							</Tabs.Tab>
						))}
					</Tabs.List>
				</Tabs.ListContainer>
			</Tabs>
			<div className="min-w-0">
				<Outlet />
			</div>
		</Page>
	);
}
