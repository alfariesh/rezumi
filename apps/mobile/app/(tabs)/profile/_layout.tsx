import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { routes } from "@/routes";
import { useTabRootBack } from "@/shell/tab-root-back";

// A link straight to a page of this tab keeps the tab's first screen under it, so Back works.
export const unstable_settings = { initialRouteName: "index" };

export default function ProfileLayout() {
	const { t } = useLingui();
	const back = useTabRootBack(routes.profile(), t`Profile`);
	return (
		<Stack>
			<Stack.Screen name="index" options={{ headerShown: false, title: t`Profile` }} />
			<Stack.Screen name="entry/[section]/[item]" options={(props) => ({ title: "", ...back(props) })} />
			<Stack.Screen name="summary" options={(props) => ({ title: t`Summary`, ...back(props) })} />
			<Stack.Screen name="bring" options={(props) => ({ title: t`Bring what you have`, ...back(props) })} />
		</Stack>
	);
}
