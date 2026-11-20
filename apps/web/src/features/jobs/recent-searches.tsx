import type { JobsSearch } from "./search";
import type { JobSearchRecent } from "@rezumi/schema/jobs/search";
import { Widget } from "@heroui-pro/react";
import { Button, Chip, Popover, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { countryName } from "@rezumi/utils/region";
import { searchFilterLabels } from "./format";
import { fromCriteria } from "./search";
import { WidgetAction, WidgetHeading } from "@/components/layout/widget-heading";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

/**
 * The person's recent job searches (`jobs.recent`, kept on the server: the same on every device and for MCP), newest
 * first. Each says whether opening it again today is free: the day's searches count pages, and a page opened today
 * opens again for nothing.
 */
export function useRecentSearches(enabled = true) {
	const queryClient = useQueryClient();
	const query = useQuery({ ...orpc.jobs.recent.queryOptions(), enabled });
	const refresh = () => void queryClient.invalidateQueries({ queryKey: orpc.jobs.recent.key() });
	// Only this list changes: the rest of the page (the search, which costs a search to ask again) stays as it is.
	const forget = useMutation({
		...orpc.jobs.forgetRecent.mutationOptions({ meta: { noInvalidate: true } }),
		onSuccess: refresh,
		onError: (error) => toastError(error, t`That didn't save. Try again.`),
	});
	const clear = useMutation({
		...orpc.jobs.clearRecent.mutationOptions({ meta: { noInvalidate: true } }),
		onSuccess: refresh,
		onError: (error) => toastError(error, t`That didn't save. Try again.`),
	});
	return {
		searches: query.data?.searches,
		isPending: query.isPending,
		forget: (id: string) => forget.mutate({ id }),
		clear: () => clear.mutate({}),
		refresh,
	};
}

type RecentSearches = ReturnType<typeof useRecentSearches>;

/** Where a search looks: the city and country, the country, or anywhere. */
function placeOf(search: JobSearchRecent, locale: string) {
	const country = search.criteria.country ? countryName(search.criteria.country, locale) : "";
	const parts = [search.criteria.location, country].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : t`Anywhere`;
}

type RecentSearchRowProps = {
	search: JobSearchRecent;
	onOpen: (next: JobsSearch) => void;
	onForget: (id: string) => void;
};

/** One recent search: the role, where and its filters, whether it's free today, and a button to forget it. */
function RecentSearchRow({ search, onOpen, onForget }: RecentSearchRowProps) {
	const { i18n } = useLingui();
	const details = [placeOf(search, i18n.locale), ...searchFilterLabels(search.criteria, i18n.locale)].join(" · ");
	return (
		<li className="relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-quick hover:bg-default">
			<Icon name="clock-counter-clockwise" size={18} className="shrink-0 text-muted" />
			<div className="grid min-w-0 flex-1 gap-0.5">
				{/* The whole row runs the search; its remove button sits above this one. */}
				<button
					type="button"
					className="truncate text-start text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-focus"
					onClick={() => onOpen(fromCriteria(search.criteria))}
				>
					{search.criteria.query}
				</button>
				<p className="truncate text-body-xs text-muted">{details}</p>
			</div>
			<Chip size="sm" variant="soft" color={search.seenToday ? "success" : "default"} className="shrink-0">
				<Chip.Label>
					{search.seenToday ? (
						<Trans comment="A recent job search that opens again today without counting">Free today</Trans>
					) : (
						<Trans comment="A recent job search that counts toward today's searches when opened">Uses 1 search</Trans>
					)}
				</Chip.Label>
			</Chip>
			<IconButton
				icon="x"
				size="sm"
				variant="ghost"
				label={t`Remove ${search.criteria.query} from recent searches`}
				className="relative z-10 shrink-0"
				onPress={() => onForget(search.id)}
			/>
		</li>
	);
}

type RecentSearchListProps = {
	recent: RecentSearches;
	searches: JobSearchRecent[];
	onOpen: (next: JobsSearch) => void;
};

function RecentSearchList({ recent, searches, onOpen }: RecentSearchListProps) {
	return (
		<ul className="grid gap-0.5">
			{searches.map((search) => (
				<RecentSearchRow key={search.id} search={search} onOpen={onOpen} onForget={recent.forget} />
			))}
		</ul>
	);
}

type RecentSearchesWidgetProps = { recent: RecentSearches; onOpen: (next: JobsSearch) => void };

/** The Jobs page's start: the person's recent searches, to open again with one press. Nothing while there are none. */
export function RecentSearchesWidget({ recent, onOpen }: RecentSearchesWidgetProps) {
	const titleId = useId();
	if (recent.isPending)
		return (
			<div className="grid gap-2" aria-busy="true" aria-label={t`Loading recent job searches`}>
				{Array.from({ length: 3 }, (_, index) => (
					<Skeleton key={index} className="h-14 rounded-xl" />
				))}
			</div>
		);
	if (!recent.searches?.length) return null;
	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading
				id={titleId}
				icon="clock-counter-clockwise"
				title={<Trans>Recent job searches</Trans>}
				action={
					<WidgetAction onPress={recent.clear}>
						<Trans comment="Removes every recent job search">Clear</Trans>
					</WidgetAction>
				}
			/>
			<Widget.Content className="p-2">
				<RecentSearchList recent={recent} searches={recent.searches} onOpen={onOpen} />
			</Widget.Content>
		</Widget>
	);
}

type RecentSearchesButtonProps = { recent: RecentSearches; onOpen: (next: JobsSearch) => void };

/** Recent searches over the results, from a button: the page shows the last search, so the others are one press away. */
export function RecentSearchesButton({ recent, onOpen }: RecentSearchesButtonProps) {
	const [isOpen, setOpen] = useState(false);
	if (!recent.searches || recent.searches.length < 2) return null;
	return (
		<Popover isOpen={isOpen} onOpenChange={setOpen}>
			<Button size="sm" variant="ghost">
				<Icon name="clock-counter-clockwise" size={16} />
				<Trans>Recent searches</Trans>
			</Button>
			<Popover.Content placement="bottom end" className="w-[26rem] max-w-[calc(100vw-2rem)]">
				<Popover.Dialog aria-label={t`Recent job searches`} className="grid gap-1 p-1">
					<div className="flex items-center justify-between px-2 pt-1">
						<p className="text-sm font-semibold">
							<Trans>Recent job searches</Trans>
						</p>
						<WidgetAction
							onPress={() => {
								recent.clear();
								setOpen(false);
							}}
						>
							<Trans comment="Removes every recent job search">Clear</Trans>
						</WidgetAction>
					</div>
					<RecentSearchList
						recent={recent}
						searches={recent.searches}
						onOpen={(next) => {
							setOpen(false);
							onOpen(next);
						}}
					/>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
