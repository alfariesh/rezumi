import type { IconName } from "@rezumi/ui/components/icon";
import { Chip, Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/career/knowledge")({
	component: KnowledgeLayout,
});

type Section = {
	to:
		| "/dashboard/career/knowledge/facts"
		| "/dashboard/career/knowledge/stories/{-$storyId}"
		| "/dashboard/career/knowledge/preferences";
	match: string;
	icon: IconName;
	label: string;
	count?: number | undefined;
};

/** Knowledge: facts, stories and preferences. Tabs above the page. */
function KnowledgeLayout() {
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	const facts = useQuery(orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } }));
	const stories = useQuery(orpc.career.stories.queryOptions({ input: { applicationId: null } }));
	const sections: Section[] = [
		{
			to: "/dashboard/career/knowledge/facts",
			match: "/dashboard/career/knowledge/facts",
			icon: "list-checks",
			label: t`Facts`,
			count: facts.data?.filter((fact) => fact.status !== "forgotten").length,
		},
		{
			to: "/dashboard/career/knowledge/stories/{-$storyId}",
			match: "/dashboard/career/knowledge/stories",
			icon: "book-open",
			label: t`Stories`,
			count: stories.data?.length,
		},
		{
			to: "/dashboard/career/knowledge/preferences",
			match: "/dashboard/career/knowledge/preferences",
			icon: "sliders-horizontal",
			label: t({
				message: "Preferences",
				context: "Career preferences: the roles, places, pay and ways of working you want",
			}),
		},
	];

	const selected = sections.find((section) => matchRoute({ to: section.match, fuzzy: true }));

	return (
		<div className="grid min-w-0 gap-5">
			<Tabs
				selectedKey={selected?.match ?? ""}
				onSelectionChange={(key) => {
					const next = sections.find((section) => section.match === key);
					if (next) void navigate({ to: next.to });
				}}
				className="[view-transition-name:knowledge-nav]"
			>
				<Tabs.ListContainer className="w-fit max-w-full">
					<Tabs.List aria-label={t`Knowledge`}>
						{sections.map((section, index) => (
							<Tabs.Tab key={section.match} id={section.match} className="w-auto flex-none gap-2 px-4">
								{index > 0 && <Tabs.Separator />}
								<Icon name={section.icon} size={18} className="hidden sm:block" />
								{section.label}
								{section.count !== undefined && (
									<Chip size="sm" variant="soft" className="hidden tabular-nums sm:inline-flex">
										{section.count}
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
		</div>
	);
}
