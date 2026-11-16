import { useNavigate, useRouterState } from "@tanstack/react-router";
import { openCoachPanel, useCoachPanelStore } from "./store";

/** An application's workspace, which has a coach of its own (the `?coach=` sheet) for that job. */
export const WORKSPACE_ROUTE = "/dashboard/applications/$applicationId/{-$tab}";

/** The open application workspace's params, or undefined on any other page. */
export function useWorkspaceParams() {
	const applicationId = useRouterState({
		select: (state): string | undefined =>
			state.matches.find((match) => match.routeId === WORKSPACE_ROUTE)?.params.applicationId,
	});
	const tab = useRouterState({
		select: (state): string | undefined => state.matches.find((match) => match.routeId === WORKSPACE_ROUTE)?.params.tab,
	});
	return applicationId ? { applicationId, tab } : undefined;
}

/**
 * Opens the coach the page has: on an application's workspace, that job's coach sheet; anywhere else, the panel.
 * `toggle` (the navbar's button) closes the panel when it's open; `open` (the command palette) only opens it.
 */
export function useCoachLauncher() {
	const navigate = useNavigate();
	const workspace = useWorkspaceParams();
	const search = useRouterState({ select: (state) => state.location.search });

	return (mode: "open" | "toggle") => {
		if (workspace) {
			// Replaced, not pushed: the sheet's own close then leaves no entry that Back would reopen it from.
			void navigate({ to: WORKSPACE_ROUTE, params: workspace, search: { ...search, coach: true }, replace: true });
			return;
		}
		if (mode === "toggle") useCoachPanelStore.getState().toggle();
		else openCoachPanel();
	};
}
