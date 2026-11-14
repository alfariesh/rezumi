import { Spinner } from "@heroui/react";
import { ConnectScreen } from "./connect-screen";
import { ConnectedScreen } from "./connected-screen";
import { useConnection } from "./connection";
import { PageScreen } from "./page-screen";

/** Development builds: `sidepanel.html?tab=<id>&reading` shows only the page reading, signed in or not (tests). */
const readingOnly = __DEV__ && new URLSearchParams(location.search).has("reading");

/** The side panel: "Connect to Rezumi" until an account is connected, then the account's screens. */
export function App() {
	const connection = useConnection();

	if (readingOnly)
		return (
			<main className="flex flex-col gap-4 p-4">
				<PageScreen />
			</main>
		);

	if (connection.isPending)
		return (
			<main className="grid min-h-svh place-items-center">
				<Spinner aria-hidden />
			</main>
		);
	if (connection.data?.state === "connected") return <ConnectedScreen account={connection.data.account} />;
	return <ConnectScreen expired={connection.data?.state === "expired"} />;
}
