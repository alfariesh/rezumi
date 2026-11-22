// A tab whose screen is not rebuilt yet (Portfolio until Phase 12): the tab bar and its actions work, the page says
// what is coming and opens the web page that does it meanwhile. Never in a store build (Phase 16 checks).
import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import { openBrowserAsync } from "expo-web-browser";
import { View } from "react-native";
import { TabTopBar } from "./tab-chrome";
import { useSession } from "@/auth/session";
import { EmptyState, Screen, showToast } from "@/ui";

type PreparingTabProps = {
	title: string;
	icon: IconName;
	heading: string;
	description: string;
	/** The web page that does the same today, opened in the in-app browser. */
	webPath: string;
};

export function PreparingTab({ title, icon, heading, description, webPath }: PreparingTabProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const openWeb = () =>
		void openBrowserAsync(`${server}${webPath}`).catch(() =>
			showToast({ title: t`Couldn't open the browser. Try again.` }),
		);
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={title} />
			<Screen>
				<EmptyState
					kind="page"
					icon={icon}
					title={heading}
					description={description}
					action={{ label: t`Open on the web`, onPress: openWeb }}
				/>
			</Screen>
		</View>
	);
}
