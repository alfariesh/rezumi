import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { resolveLanguage } from "../shared/storage";
import { ConnectScreen } from "./connect-screen";
import { ConnectedScreen } from "./connected-screen";
import { useConnection } from "./connection";
import { activatePanelLocale } from "./i18n";
import { PageScreen } from "./page-screen";
import { useSettings } from "./stores";

/** Development builds: `sidepanel.html?tab=<id>&reading` shows only the page reading, signed in or not (tests). */
const readingOnly = __DEV__ && new URLSearchParams(location.search).has("reading");

/** The side panel: "Connect to Rezumi" until an account is connected, then the account's screens. */
export function App() {
	const connection = useConnection();
	const [settings] = useSettings();
	const language = settings?.language;
	// The language setting applies at once, here and (through the service worker) to the on-page button.
	useEffect(() => {
		if (language) activatePanelLocale(resolveLanguage(language, chrome.i18n.getUILanguage()));
	}, [language]);

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
