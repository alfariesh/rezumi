import { Trans } from "@lingui/react/macro";
import { ApiKeysSection } from "./ai/api-keys";
import { ConnectedAppsSection } from "./ai/connected-apps";
import { McpSection } from "./ai/mcp";
import { ProvidersSection } from "./ai/providers";
import { WebAccessSection } from "./ai/web-access";
import { GeneralSection } from "./general";
import { PageHeader } from "@/components/layout/page-header";

/** How the app looks and reads, then the tools it connects to: AI providers, web access, API keys and MCP. */
export function AppSettings() {
	return (
		<>
			<PageHeader
				title={<Trans>Settings</Trans>}
				description={
					<Trans>Appearance, language and the tools you connect for writing, job search and your resumes.</Trans>
				}
			/>
			<GeneralSection />
			<ProvidersSection />
			<WebAccessSection />
			<ApiKeysSection />
			<ConnectedAppsSection />
			<McpSection />
		</>
	);
}
