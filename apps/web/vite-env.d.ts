declare const __APP_VERSION__: string;

declare module "*.css";
declare module "*?url" {
	const url: string;
	export default url;
}
declare module "@fontsource/*" {}
declare module "@fontsource-variable/*" {}

/** The public docs' pages and navigation, from the repository's docs/ folder (src/features/docs/build.ts). */
declare module "virtual:rezumi-docs" {
	import type { DocsGroup, DocsModule, DocsPageMeta } from "@/features/docs/types";

	export const groups: DocsGroup[];
	export const pages: Record<string, DocsPageMeta>;
	export const redirects: Record<string, string>;
	export const loaders: Record<string, () => Promise<DocsModule>>;
}
