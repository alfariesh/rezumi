// The List's state: search (shared with Board and Calendar), stage chip, tag, the closed switch, sort, collapsed
// groups and the multi-selection, and the rows it all leaves as one flat list of group headers and applications.
import type { ApplicationSummary } from "../types";
import type { ApplicationSort } from "@rezumi/career/applications";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { useState } from "react";
import {
	LIST_ORDER,
	applicationTags,
	filterApplications,
	groupApplications,
	visibleSelection,
} from "@rezumi/career/applications";
import { useApplicationSearch } from "./search";

export type ListItem =
	| { type: "header"; key: string; status: ApplicationStatus; count: number; collapsed: boolean }
	| { type: "row"; key: string; application: ApplicationSummary };

export type SortDirection = "asc" | "desc";

/** At most this many applications in one bulk action (the API's limit). */
export const BULK_LIMIT = 200;

const toggled = <T>(set: ReadonlySet<T>, value: T) => {
	const next = new Set(set);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return next;
};

export function useListState(applications: readonly ApplicationSummary[], now: Date) {
	const { search, setSearch } = useApplicationSearch();
	const [stage, setStageValue] = useState<ApplicationStatus | null>(null);
	const [tag, setTagValue] = useState("");
	const [showClosed, setShowClosedValue] = useState(false);
	const [sort, setSort] = useState<ApplicationSort>("updated");
	const [direction, setDirection] = useState<SortDirection>("desc");
	const [collapsed, setCollapsed] = useState<ReadonlySet<ApplicationStatus>>(() => new Set());
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
	const [selecting, setSelecting] = useState(false);

	const filtered = filterApplications(applications, { search, tag, showClosed, stage });
	const groups = groupApplications(filtered, sort, direction, now);
	const selectedIds = visibleSelection(groups, collapsed, selected);
	const items: ListItem[] = groups.flatMap((group) => [
		{
			type: "header" as const,
			key: `header-${group.status}`,
			status: group.status,
			count: group.data.length,
			collapsed: collapsed.has(group.status),
		},
		...(collapsed.has(group.status)
			? []
			: group.data.map((application) => ({ type: "row" as const, key: application.id, application }))),
	]);

	// Chip counts follow the search and tag, not the stage chip itself; Closed counts even while the switch is off.
	const searched = filterApplications(applications, { search, tag, showClosed: true, stage: null });
	const counts = Object.fromEntries(
		LIST_ORDER.map((status) => [status, searched.filter((application) => application.status === status).length]),
	) as Record<ApplicationStatus, number>;
	const allCount = showClosed ? searched.length : searched.length - counts.closed;

	// Changing what's shown drops the selection, so nothing hidden stays selected for a bulk action.
	const clearSelection = () => setSelected(new Set());
	const change =
		<T>(setter: (value: T) => void) =>
		(value: T) => {
			setter(value);
			clearSelection();
		};

	return {
		search,
		stage,
		tag,
		showClosed,
		sort,
		direction,
		setSearch: change(setSearch),
		setStage: change(setStageValue),
		setTag: change(setTagValue),
		setShowClosed: change(setShowClosedValue),
		setSort,
		setDirection,
		tags: applicationTags(applications),
		counts,
		allCount,
		items,
		filtered,
		filtersActive: Boolean(search.trim() || tag || showClosed || stage),
		clearFilters: () => {
			setSearch("");
			setTagValue("");
			setShowClosedValue(false);
			setStageValue(null);
			clearSelection();
		},
		toggleGroup: (status: ApplicationStatus) => setCollapsed((current) => toggled(current, status)),
		selecting,
		selectedIds,
		selectedRows: filtered.filter((application) => selectedIds.includes(application.id)),
		isSelected: (id: string) => selectedIds.includes(id),
		/** Long press: select mode with this row picked. */
		startSelecting: (id: string) => {
			setSelecting(true);
			setSelected(new Set([id]));
		},
		toggleSelected: (id: string) => setSelected((current) => toggled(current, id)),
		selectAllVisible: () =>
			setSelected(new Set(items.flatMap((item) => (item.type === "row" ? [item.application.id] : [])))),
		stopSelecting: () => {
			setSelecting(false);
			clearSelection();
		},
	};
}

export type ListState = ReturnType<typeof useListState>;
