/** Set by scripts/build-config.ts at build time. */
declare const __DEV__: boolean;
/** The Rezumi server this build talks to (REZUMI_URL). */
declare const __REZUMI_URL__: string;
/** The extension's version, from package.json. */
declare const __EXTENSION_VERSION__: string;

declare module "*.po" {
	import type { Messages } from "@lingui/core";

	export const messages: Messages;
}
