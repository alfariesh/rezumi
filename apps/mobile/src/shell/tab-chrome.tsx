// The chrome every tab shares (01-desain 2.1): the top bar's Coach · Search · avatar, the page title, and the one
// floating New button of Home and Documents. Screens not rebuilt yet get the same actions through their old header
// (`CollectionHeader` reads `InTabs`).
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { createContext, use } from "react";
import { AccountButton } from "./account-menu";
import { useIsTablet } from "./use-is-tablet";
import { routes } from "@/routes";
import { Fab, IconButton, TopBar } from "@/ui";

/** True inside the tab shell: the old screens' headers then add the tab bar's actions. */
export const InTabs = createContext(false);

export function useInTabs() {
	return use(InTabs);
}

/**
 * Opens Coach. Phase 11 turns this into the Coach sheet (phones) and side panel (tablets); until then it pushes the
 * existing Coach screen, so every caller already goes through the slot.
 */
export function useOpenCoach() {
	const router = useRouter();
	return () => router.push(routes.coach());
}

/** Coach, Search and the account menu, at the end of a tab's top bar. */
export function TabBarActions() {
	const { t } = useLingui();
	const router = useRouter();
	const openCoach = useOpenCoach();
	const tablet = useIsTablet();
	return (
		<>
			<IconButton icon="sparkle" label={t`Coach`} onPress={openCoach} testID="open-coach" />
			<IconButton
				icon="magnifying-glass"
				label={t`Search`}
				onPress={() => router.push(routes.search())}
				testID="open-search"
			/>
			{/* The sidebar holds the account on tablets. */}
			{tablet ? null : <AccountButton />}
		</>
	);
}

type TabTopBarProps = { title: string };

/** A tab's top bar: the actions row, then the 30 pt page title. */
export function TabTopBar({ title }: TabTopBarProps) {
	return <TopBar title={title} large actions={<TabBarActions />} />;
}

/** New (resume, letter, import, sample) from Home and Documents on phones; the sidebar has its own New on tablets. */
export function NewFab() {
	const { t } = useLingui();
	const router = useRouter();
	if (useIsTablet()) return null;
	return <Fab icon="plus" label={t`New`} safeArea={false} onPress={() => router.push(routes.new())} testID="new-fab" />;
}
