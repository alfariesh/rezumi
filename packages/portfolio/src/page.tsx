import type { PortfolioPageMessages } from "./messages";
import type { RenderContext } from "./shared/context";
import type { PortfolioView } from "./view";
import { renderToStaticMarkup } from "react-dom/server";
import { designCss, fontFaceCss, portfolioFontFaces, preloadFont } from "./design";
import { effectAssets } from "./effects";
import { PORTFOLIO_PAGE_SCRIPT } from "./script";
import { BASE_CSS } from "./shared/base-css";
import { RenderContextValue } from "./shared/context";
import { themeRenderer } from "./themes";

export type RenderPortfolioPageInput = {
	view: PortfolioView;
	messages: PortfolioPageMessages;
	/** Shapes of the resume icons the page uses (`portfolioIconNames`), by name; missing ones are left out. */
	icons?: Readonly<Record<string, string>>;
	/**
	 * An image address as the page loads it, or undefined to leave the picture out. By default http(s) addresses and
	 * paths on the page's own site load as given (`pageImageUrl`); anything else (`data:`, `javascript:`, `//host`)
	 * doesn't.
	 */
	imageUrl?: (src: string) => string | undefined;
	/** The footer's year. Given rather than read from the clock, so a render is a pure function of its input. */
	year: number;
	/** Where the "Made with Rezumi" badge links: the app's home. */
	creditUrl: string;
};

export type PortfolioPage = {
	lang: string;
	dir: "ltr" | "rtl";
	/** The mode to set on `<html data-pf-scheme>`: light, dark, or auto (follow the device). */
	scheme: PortfolioView["design"]["scheme"];
	/** The page's body. */
	html: string;
	/** Tags React wants in `<head>` (the preload of the first picture). */
	head: string;
	/** Font faces, tokens, shared and theme rules. */
	css: string;
	/** The page script (allowed by hash): the same text on every page, plus the intro effect's when it needs one. */
	script: string;
	/** A font file worth preloading. */
	preloadFont: string | null;
	/** The page background per mode, for the browser's `theme-color`. */
	themeColors: { light: string; dark: string };
};

/** An address an `<img>` may load: http(s), or a path on the page's own site (not `//host`, no other scheme). */
// Browsers read a leading `\` like `/`, so `/\host` and `\\host` are other sites too.
const PAGE_IMAGE = /^(?:https?:\/\/|\/(?![/\\])|(?![a-z][\d+.a-z-]*:)[^/\\])/i;

/** The default `imageUrl`: allowed addresses (`PAGE_IMAGE`) as given, others left out. */
const pageImageUrl = (src: string) => (PAGE_IMAGE.test(src) ? src : undefined);

/**
 * The resume icons a view draws (service, metric and client icons, link cards' brands), for the caller to load before
 * rendering. The intro's highlights are drawn compact, without their icons, so theirs aren't loaded.
 */
export function portfolioIconNames(view: PortfolioView): string[] {
	const names = new Set<string>();
	for (const work of view.works)
		for (const block of work.blocks)
			if (block.type === "metrics") for (const metric of block.items) if (metric.icon) names.add(metric.icon);
	for (const work of view.works)
		for (const block of work.blocks) if (block.type === "link" && block.brandIcon) names.add(block.brandIcon);
	for (const section of view.sections) {
		if (section.kind === "services") for (const service of section.services) if (service.icon) names.add(service.icon);
		if (section.kind === "clients")
			for (const client of section.clients) if (client.brandIcon) names.add(client.brandIcon);
	}
	return [...names];
}

/**
 * Renders a portfolio page from its view (`02-teknis.md` 5.1): plain React to static HTML, CSS as text, no request to
 * any other service. Runs on the server and in the browser (the editor's preview, Phase 03).
 */
export function renderPortfolioPage(input: RenderPortfolioPageInput): PortfolioPage {
	const { view } = input;
	const theme = themeRenderer(view.theme);
	let counter = 0;
	const icons = input.icons ?? {};
	const context: RenderContext = {
		view,
		messages: input.messages,
		locale: view.locale,
		// Only the map's own entries, and only text: a name such as "constructor" must not reach Object's prototype.
		icon: (name) => {
			const shape = name && Object.hasOwn(icons, name) ? icons[name] : undefined;
			return typeof shape === "string" ? shape : null;
		},
		imageUrl: input.imageUrl ?? pageImageUrl,
		nextId: (prefix) => `${prefix}-${++counter}`,
	};
	const markup = renderToStaticMarkup(
		<RenderContextValue.Provider value={context}>
			<theme.Page year={input.year} creditUrl={input.creditUrl} />
		</RenderContextValue.Provider>,
	);
	// React hoists a preload for the high-priority picture to the front of its output; it belongs in <head>.
	const hoisted = /^(?:<link [^>]*\/?>)+/.exec(markup)?.[0] ?? "";
	const html = markup.slice(hoisted.length);
	const faces = portfolioFontFaces(view, theme.headingWeights);
	const effect = effectAssets(view, theme.palette);
	return {
		lang: view.locale,
		dir: view.dir,
		scheme: view.design.scheme,
		html,
		head: hoisted,
		css: [
			fontFaceCss(faces, theme.headingDisplay === "optional" ? view.design.fonts.heading : undefined),
			designCss(view, theme.palette),
			BASE_CSS,
			theme.css,
			effect.css,
		]
			.filter(Boolean)
			.join("\n"),
		script: PORTFOLIO_PAGE_SCRIPT + effect.script,
		preloadFont: preloadFont(view, faces, theme.nameWeight),
		themeColors: { light: theme.palette.light.bg, dark: theme.palette.dark.bg },
	};
}
