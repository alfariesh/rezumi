// The builder's Share pane (plans/mobile Phase 08): publishing, the web page and who sees what.
import { useLingui } from "@lingui/react/macro";
import { useNetworkState } from "expo-network";
import { View } from "react-native";
import { ShareNotice } from "./custom-domain";
import { useShareDocument } from "./document";
import { LinkTab } from "./link";
import { useSession } from "@/auth/session";
import { Screen, Skeleton } from "@/ui";

type SharePaneProps = { id: string };

export function SharePane({ id }: SharePaneProps) {
	const { t } = useLingui();
	const draft = useShareDocument(id);
	const session = useSession();
	const network = useNetworkState();
	const offline = network.isConnected === false || network.isInternetReachable === false;

	return (
		<Screen edges={["bottom"]} testID="share-pane">
			{/* Phones use the whole width; tablets keep the settings to a readable column. */}
			<View className="w-full max-w-xl gap-4 self-center">
				{offline ? <ShareNotice status="accent">{t`You're offline. Sharing needs a connection.`}</ShareNotice> : null}
				{session.status !== "signed-in" ? <ShareNotice status="warning">{t`Sign in to continue.`}</ShareNotice> : null}
				{draft.document ? (
					<LinkTab key={id} resume={draft.document} offline={offline} />
				) : (
					<View className="gap-4" accessibilityLabel={t`Loading`}>
						<Skeleton variant="none" className="h-16 w-full rounded-2xl" />
						<Skeleton variant="none" className="h-12 w-full rounded-xl" />
						<Skeleton variant="none" className="h-40 w-full rounded-2xl" />
					</View>
				)}
			</View>
		</Screen>
	);
}
