// A tab whose screen is not rebuilt yet (Portfolio until Phase 12, Profile until Phase 06): the tab bar and its
// actions work, the page says what is coming and where to do it meanwhile. Never in a store build (Phase 16 checks).
import type { EmptyStateAction, IconName } from "@/ui";
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
	action?: EmptyStateAction | undefined;
	/** The web page that does the same today, opened in the in-app browser. */
	webPath: string;
};

export function PreparingTab({ title, icon, heading, description, action, webPath }: PreparingTabProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const openWeb = () =>
		void openBrowserAsync(`${server}${webPath}`).catch(() =>
			showToast({ title: t`Couldn't open the browser. Try again.` }),
		);
	const web = { label: t`Open on the web`, onPress: openWeb };
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={title} />
			<Screen>
				<EmptyState
					kind="page"
					icon={icon}
					title={heading}
					description={description}
					action={action ?? web}
					secondaryAction={action ? web : undefined}
				/>
			</Screen>
		</View>
	);
}
