import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { guardSetup, type SetupLockEnv } from "./lib/setup-lock";

// The plugin bridge is inert until a sandboxed plugin is installed; exporting it keeps that option open.
export { PluginBridge };

type Fetch = NonNullable<typeof handler.fetch>;

// Astro serves requests; the Cron Trigger in wrangler.jsonc publishes scheduled posts and runs EmDash maintenance.
// EmDash's first-run setup is locked behind the BLOG_SETUP_TOKEN secret first (src/lib/setup-lock.ts).
export default {
	...handler,
	async fetch(request: Parameters<Fetch>[0], env: Parameters<Fetch>[1], context: Parameters<Fetch>[2]) {
		const refused = await guardSetup(request as unknown as Request, (env ?? {}) as SetupLockEnv);
		if (refused) return refused as unknown as Awaited<ReturnType<Fetch>>;
		if (!handler.fetch) return new Response(null, { status: 500 }) as unknown as Awaited<ReturnType<Fetch>>;
		return handler.fetch(request, env, context);
	},
	scheduled: createScheduledHandler(),
};
