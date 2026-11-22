// The chrome every section shares (01-desain 2.1): on phones the avatar that opens the drawer at the start of the top
// bar, Coach and Search at its end, the page title, and the one floating New button of Home and Documents. Screens not
// rebuilt yet get the same controls through their old header (`CollectionHeader` reads `InTabs`).
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { createContext, use } from "react";
import { DrawerButton } from "./app-drawer";
import { useIsTablet } from "./use-is-tablet";
import { routes } from "@/routes";
import { Fab, IconButton, TopBar } from "@/ui";

/** True inside the section shell: the old screens' headers then add the drawer's avatar, Coach and Search. */
export const InTabs = createContext(false);

export function useInTabs() {
	return use(InTabs);
}

/**
 * Opens Coach. Phase 11 turns this into the Coach sheet (phones) and side panel (tablets); until then it pushes the
 * existing Coach screen, so every caller already goes through the slot.
 */
function useOpenCoach() {
	const router = useRouter();
	return () => router.push(routes.coach());
}

/** The drawer's avatar at the start of a section's top bar on phones; tablets have the sidebar instead. */
export function TabBarLeading() {
	return useIsTablet() ? null : <DrawerButton />;
}

/** Coach and Search, at the end of a section's top bar. */
export function TabBarActions() {
	const { t } = useLingui();
	const router = useRouter();
	const openCoach = useOpenCoach();
	return (
		<>
			<IconButton icon="sparkle" label={t`Coach`} onPress={openCoach} testID="open-coach" />
			<IconButton
				icon="magnifying-glass"
				label={t`Search`}
				onPress={() => router.push(routes.search())}
				testID="open-search"
			/>
		</>
	);
}

type TabTopBarProps = { title: string };

/** A tab's top bar: the actions row, then the 30 pt page title. */
export function TabTopBar({ title }: TabTopBarProps) {
	return <TopBar title={title} large leading={<TabBarLeading />} actions={<TabBarActions />} />;
}

/** New (resume, letter, import, sample) from Home and Documents on phones; the sidebar has its own New on tablets. */
export function NewFab() {
	const { t } = useLingui();
	const router = useRouter();
	if (useIsTablet()) return null;
	return <Fab icon="plus" label={t`New`} safeArea={false} onPress={() => router.push(routes.new())} testID="new-fab" />;
}
