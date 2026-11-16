import { t } from "@lingui/core/macro";
import { createFileRoute } from "@tanstack/react-router";
import { ExtensionRemovedPage } from "@/features/extension/removed-page";
import { createNoindexFollowMeta } from "@/libs/seo";

// Opened by the browser when the Rezumi extension is removed (`setUninstallURL`). Public, light, and kept out of
// search results; the server answers it with the same `noindex` header (apps/server/src/static/web.ts).
export const Route = createFileRoute("/_home/extension/removed")({
	component: ExtensionRemovedPage,
	head: () => ({
		meta: [{ title: `${t`Extension removed`} | Rezumi` }, createNoindexFollowMeta()],
	}),
});
