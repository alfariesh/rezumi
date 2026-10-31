import type { IconName } from "@rezumi/ui/components/icon";
import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
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

/** Knowledge: facts, stories and preferences. A sticky list at md and up, a segmented row above on phones. */
function KnowledgeLayout() {
	const matchRoute = useMatchRoute();
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

	return (
		<div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[200px_minmax(0,1fr)] 2xl:gap-8">
			<aside className="grid gap-3 [view-transition-name:knowledge-nav] 2xl:sticky 2xl:top-6 2xl:gap-4">
				<nav
					aria-label={t`Knowledge`}
					className="flex w-fit gap-1 rounded-2xl bg-default p-1 max-sm:w-full 2xl:grid 2xl:w-auto 2xl:gap-0.5 2xl:bg-transparent 2xl:p-0"
				>
					{sections.map((section) => {
						const selected = Boolean(matchRoute({ to: section.match, fuzzy: true }));
						return (
							<Link
								key={section.to}
								to={section.to}
								aria-current={selected ? "page" : undefined}
								className={cn(
									"touch-target flex h-9 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium sm:flex-none sm:px-4 2xl:justify-start 2xl:px-3",
									selected
										? "bg-surface text-foreground shadow-surface"
										: "text-muted hover:text-foreground 2xl:hover:bg-default",
								)}
							>
								<Icon name={section.icon} size={18} className="hidden sm:block" />
								<span className="2xl:flex-1">{section.label}</span>
								{section.count !== undefined && (
									<Chip size="sm" variant="soft" className="hidden tabular-nums sm:inline-flex">
										{section.count}
									</Chip>
								)}
							</Link>
						);
					})}
				</nav>
				<p className="hidden max-w-prose px-1 text-xs text-muted sm:block 2xl:px-3">
					<Trans>
						Your enabled facts, stories and preferences can be sent to your AI connection when you use coaching tools or
						scheduled interview preparation. In chat, the Knowledge switch controls what is added to each message.
					</Trans>
				</p>
			</aside>
			<div className="min-w-0">
				<Outlet />
			</div>
		</div>
	);
}
