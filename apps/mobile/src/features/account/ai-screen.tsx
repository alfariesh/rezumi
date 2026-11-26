import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { SettingsPage } from "./layout";
import { routes } from "@/routes";
import { ListRow, ListSection } from "@/ui";

export default function AiScreen() {
	const router = useRouter();
	const { t } = useLingui();

	return (
		<SettingsPage title={t`AI & developer`}>
			<ListSection>
				<ListRow
					title={t`AI providers`}
					description={t`Manage connections and choose a default source.`}
					icon="sparkle"
					onPress={() => router.push(routes.account("ai-providers"))}
				/>
				<ListRow
					title={t`AI data sharing`}
					icon="shield-check"
					onPress={() => router.push(routes.account("ai-privacy"))}
				/>
				<ListRow title={t`MCP server`} icon="terminal-window" onPress={() => router.push(routes.account("ai-mcp"))} />
				<ListRow
					title={t`Report AI content`}
					icon="warning-circle"
					onPress={() => router.push(routes.account("ai-report"))}
				/>
			</ListSection>
		</SettingsPage>
	);
}
