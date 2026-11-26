import { useLingui } from "@lingui/react/macro";
import { setStringAsync } from "expo-clipboard";
import { useBrowserLink } from "./browser";
import { SettingsPage } from "./layout";
import { useSession } from "@/auth/session";
import { Button, Card, ListRow, ListSection, Text, showToast } from "@/ui";

export default function McpScreen() {
	const { t } = useLingui();
	const { server } = useSession();
	const browse = useBrowserLink();
	const address = `${server}/mcp`;
	const copy = async () => {
		try {
			if (!(await setStringAsync(address))) throw new Error("Clipboard unavailable");
			showToast({ title: t`Address copied`, variant: "success" });
		} catch {
			showToast({ title: t`Couldn't copy the address.`, variant: "danger" });
		}
	};

	return (
		<SettingsPage title={t`MCP server`}>
			<Text tone="muted">{t`Let AI clients like Claude or Cursor read and edit your resumes, using an API key.`}</Text>
			<Card>
				<Card.Body className="gap-3">
					<Text selectable mono>
						{address}
					</Text>
					<Button variant="secondary" onPress={() => void copy()}>
						<Button.Label>{t`Copy address`}</Button.Label>
					</Button>
				</Card.Body>
			</Card>
			<ListSection footer={t`Treat API keys like passwords. Revoke a key in Account to stop the app using it.`}>
				<ListRow
					title={t`Setup guide`}
					icon="book-open"
					onPress={() => void browse("https://rezumi.app/docs/guides/using-the-mcp-server")}
				/>
			</ListSection>
		</SettingsPage>
	);
}
