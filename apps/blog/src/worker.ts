import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

// The plugin bridge is inert until a sandboxed plugin is installed; exporting it keeps that option open.
export { PluginBridge };

// Astro serves requests; the Cron Trigger in wrangler.jsonc publishes scheduled posts and runs EmDash maintenance.
export default {
	...handler,
	scheduled: createScheduledHandler(),
};
