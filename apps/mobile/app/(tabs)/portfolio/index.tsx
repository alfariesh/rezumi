import { useLingui } from "@lingui/react/macro";
import { PreparingTab } from "@/shell/preparing-tab";

// Until Phase 12 builds the Portfolio tab. Must not ship: the release checklist (Phase 16) checks it is gone.
export default function PortfolioTab() {
	const { t } = useLingui();
	return (
		<PreparingTab
			title={t`Portfolio`}
			icon="globe-hemisphere-west"
			heading={t`Your portfolio is coming to the app`}
			description={t`Publish, share and see who visited from your phone. Until then, manage it on the web.`}
			webPath="/dashboard/portfolio"
		/>
	);
}
