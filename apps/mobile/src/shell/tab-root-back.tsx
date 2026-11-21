// A page of a tab opened straight from a link (Offers, Profile → Stories) has nothing under it in its stack: the header gets
// a Back that replaces it with the tab's first screen, so the person is never stranded.
import type { Href } from "expo-router";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { I18nManager } from "react-native";
import { IconButton } from "@/ui";

type TabRootBackProps = { to: Href; label: string };

function TabRootBack({ to, label }: TabRootBackProps) {
	const router = useRouter();
	return (
		<IconButton
			icon={I18nManager.isRTL ? "arrow-right" : "arrow-left"}
			label={label}
			onPress={() => router.replace(to)}
		/>
	);
}

type Navigation = { canGoBack: () => boolean };

/** Stack screen options: the native back when there is a screen under this one, else Back to `to`. */
export function useTabRootBack(to: Href, label: string) {
	const { t } = useLingui();
	const backLabel = t`Back to ${label}`;
	return ({ navigation }: { navigation: Navigation }) =>
		navigation.canGoBack() ? {} : { headerLeft: () => <TabRootBack to={to} label={backLabel} /> };
}
