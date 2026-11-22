import type { ApplicationSummary } from "../types";
// Applications → All → List (plans/mobile Phase 10; the web's list-view.tsx): every application grouped by stage
// (what needs you first), with search, stage chips, tag, Show closed and sort. A tap opens the application (a sheet on
// phones, a pane beside the list on tablets), a swipe or ⋯ moves, closes or deletes it, a long press selects several.
import type { RowHandlers } from "./list-row";
import type { RowMenuTarget } from "./row-menu";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useNow, useUserTime } from "../date";
import { ApplicationDetailPane } from "../detail/detail-sheet";
import { ApplicationsFrame, useOpenApplication, useOpenApplicationId } from "../frame";
import { useApplicationActions, useApplicationDetailPrefetch, useApplications } from "../queries";
import { SaveJobSheet } from "../save-sheet";
import { ApplicationList } from "./application-list";
import { BulkBar } from "./bulk-bar";
import {
	ListAllClosed,
	ListFirstRun,
	ListLoadFailed,
	ListNoMatches,
	ListSkeleton,
	OfflineNotice,
	RefreshFailed,
} from "./list-states";
import { ListToolbar } from "./list-toolbar";
import { RowMenu } from "./row-menu";
import { useListState } from "./use-list-state";
import { useOnline } from "@/api/online";
import { useSession } from "@/auth/session";
import { routes } from "@/routes";
import { useIsTablet } from "@/shell/use-is-tablet";
import { ConfirmDialog, EmptyState } from "@/ui";

export function ApplicationsListScreen() {
	const { server } = useSession();
	// Another account or server starts with a fresh selection and menus.
	return <ApplicationsList key={server} />;
}

function ApplicationsList() {
	const { t } = useLingui();
	const router = useRouter();
	const tablet = useIsTablet();
	const query = useApplications();
	const online = useOnline();
	const now = useNow();
	const { timeZone } = useUserTime();
	const actions = useApplicationActions();
	const prefetch = useApplicationDetailPrefetch();
	const openId = useOpenApplicationId();
	const openApplication = useOpenApplication();
	const applications = query.data ?? [];
	const state = useListState(applications, now);
	const [menu, setMenu] = useState<RowMenuTarget | null>(null);
	const [deleting, setDeleting] = useState<ApplicationSummary | null>(null);
	const [saving, setSaving] = useState(false);

	// Rows get one set of callbacks for the screen's life, so a change re-renders only the row it touches.
	const current: RowHandlers = {
		onOpen: (application) => openApplication(application.id),
		onMenu: (application) => setMenu({ application, step: "menu" }),
		onSelect: (application) => state.startSelecting(application.id),
		onToggle: (application) => state.toggleSelected(application.id),
		onMove: (application, status) => actions.moveTo(application, status),
		onClose: (application) => setMenu({ application, step: "close" }),
		onDelete: setDeleting,
	};
	const latest = useRef(current);
	useLayoutEffect(() => {
		latest.current = current;
	});
	const [handlers] = useState<RowHandlers>(() => ({
		onOpen: (application) => latest.current.onOpen(application),
		onMenu: (application) => latest.current.onMenu(application),
		onSelect: (application) => latest.current.onSelect(application),
		onToggle: (application) => latest.current.onToggle(application),
		onMove: (application, status) => latest.current.onMove(application, status),
		onClose: (application) => latest.current.onClose(application),
		onDelete: (application) => latest.current.onDelete(application),
	}));

	let empty = null;
	if (query.isError && !query.data) empty = <ListLoadFailed onRetry={() => void query.refetch()} />;
	else if (!query.data) empty = <ListSkeleton />;
	else if (applications.length === 0) empty = <ListFirstRun onSaveJob={() => setSaving(true)} />;
	else if (state.items.length === 0)
		empty = state.filtersActive ? (
			<ListNoMatches search={state.search} onClear={state.clearFilters} />
		) : (
			<ListAllClosed onShowClosed={() => state.setShowClosed(true)} />
		);

	const header = (
		<View className="gap-3 pt-3">
			{!online && query.data ? <OfflineNotice /> : null}
			{online && query.isError && query.data ? <RefreshFailed onRetry={() => void query.refetch()} /> : null}
			{state.selecting ? (
				<BulkBar
					selected={state.selectedRows}
					busy={actions.pending}
					onSelectAll={state.selectAllVisible}
					onDone={state.stopSelecting}
					onMove={(rows, status) => {
						actions.moveMany(rows, status);
						state.stopSelecting();
					}}
					onClose={(rows, reason) => {
						actions.moveMany(rows, "closed", reason);
						state.stopSelecting();
					}}
					onDelete={(rows) =>
						actions.removeMany(
							rows.map((row) => row.id),
							state.stopSelecting,
						)
					}
				/>
			) : applications.length > 0 ? (
				<ListToolbar state={state} />
			) : null}
		</View>
	);

	const list = (
		<ApplicationList
			items={state.items}
			header={header}
			empty={empty}
			handlers={handlers}
			selecting={state.selecting}
			selectedIds={state.selectedIds}
			currentId={tablet ? openId : null}
			timeZone={timeZone}
			now={now}
			onToggleGroup={state.toggleGroup}
			onRefresh={query.refetch}
			onVisible={prefetch}
		/>
	);

	return (
		<ApplicationsFrame view="list" detailBeside={tablet}>
			{tablet ? (
				<View className="flex-1 flex-row gap-4 pe-4">
					<View className="w-2/5 max-w-[440px] min-w-[300px]">{list}</View>
					<View className="flex-1 py-3">
						{openId ? (
							<ApplicationDetailPane applicationId={openId} onClose={() => openApplication(null)} />
						) : (
							<EmptyState
								kind="inline"
								icon="briefcase"
								title={t`Choose an application`}
								description={t`Its stage, next step, notes and files show here.`}
							/>
						)}
					</View>
				</View>
			) : (
				list
			)}
			<RowMenu
				target={menu}
				onDismiss={() => setMenu(null)}
				onOpen={(application) => openApplication(application.id)}
				onWorkspace={(application) => router.push(routes.application(application.id))}
				onMove={(application, status) => actions.moveTo(application, status)}
				onCloseWith={(application, reason) => actions.moveTo(application, "closed", reason)}
				onSelect={(application) => state.startSelecting(application.id)}
				onDelete={setDeleting}
			/>
			<ConfirmDialog
				isOpen={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={t`Delete this application?`}
				message={
					deleting
						? t`“${deleting.role} · ${deleting.company}” and its timeline are deleted permanently. This can't be undone.`
						: undefined
				}
				confirmLabel={t`Delete application`}
				cancelLabel={t`Keep application`}
				destructive
				onConfirm={() => {
					if (!deleting) return;
					const id = deleting.id;
					actions.remove(id, () => {
						if (openId === id) openApplication(null);
					});
				}}
			/>
			<SaveJobSheet
				isOpen={saving}
				onOpenChange={setSaving}
				onSaved={(id) => {
					setSaving(false);
					openApplication(id);
				}}
			/>
		</ApplicationsFrame>
	);
}
