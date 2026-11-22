import { Redirect, useLocalSearchParams } from "expo-router";
import { isWorkspaceTab } from "@/features/workspace/part";
import { WorkspaceScreen } from "@/features/workspace/screen";
import { routes } from "@/routes";

/**
 * `/applications/:id/:part` is the workspace on that part; `default` (or no part) opens the part that fits the stage.
 * The detail is a sheet over the list now, so `details` and unknown parts go there.
 */
export default function ApplicationPartRoute() {
	const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
	if (isWorkspaceTab(tab)) return <WorkspaceScreen id={id} tab={tab} />;
	if (!tab || tab === "default") return <WorkspaceScreen id={id} tab={null} />;
	return <Redirect href={routes.applicationDetails(id)} />;
}
