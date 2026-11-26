// The chrome every section shares (01-desain 2.1): on phones the avatar that opens the drawer at the start of the top
// bar, Coach and Search at its end, the page title, and the floating New button on Home and Documents.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { DrawerButton } from "./app-drawer";
import { useOpenCoach } from "./coach-actions";
import { useIsTablet } from "./use-is-tablet";
import { routes } from "@/routes";
import { Fab, IconButton, TopBar } from "@/ui";

/** The drawer's avatar at the start of a section's top bar on phones; tablets have the sidebar instead. */
function TabBarLeading() {
	return useIsTablet("window") ? null : <DrawerButton />;
}

/** Coach and Search, at the end of a section's top bar. */
function TabBarActions() {
	const { t } = useLingui();
	const router = useRouter();
	const openCoach = useOpenCoach();
	return (
		<>
			<IconButton
				icon="sparkle"
				label={t`Coach`}
				onPress={openCoach ?? (() => router.push(routes.coach()))}
				testID="open-coach"
			/>
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
	if (useIsTablet("window")) return null;
	return <Fab icon="plus" label={t`New`} safeArea={false} onPress={() => router.push(routes.new())} testID="new-fab" />;
}
