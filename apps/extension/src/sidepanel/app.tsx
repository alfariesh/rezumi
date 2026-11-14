import { Spinner } from "@heroui/react";
import { ConnectScreen } from "./connect-screen";
import { ConnectedScreen } from "./connected-screen";
import { useConnection } from "./connection";

/** The side panel: "Connect to Rezumi" until an account is connected, then the account's screens. */
export function App() {
	const connection = useConnection();

	if (connection.isPending)
		return (
			<main className="grid min-h-svh place-items-center">
				<Spinner aria-hidden />
			</main>
		);
	if (connection.data?.state === "connected") return <ConnectedScreen account={connection.data.account} />;
	return <ConnectScreen expired={connection.data?.state === "expired"} />;
}
