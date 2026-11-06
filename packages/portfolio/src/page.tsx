import type { PortfolioPageMessages } from "./messages";
import type { RenderContext } from "./shared/context";
import type { PortfolioView } from "./view";
import { renderToStaticMarkup } from "react-dom/server";
import { designCss, fontFaceCss, portfolioFontFaces, preloadFont } from "./design";
import { PORTFOLIO_PAGE_SCRIPT } from "./script";
import { BASE_CSS } from "./shared/base-css";
import { RenderContextValue } from "./shared/context";
import { themeRenderer } from "./themes";

export type RenderPortfolioPageInput = {
	view: PortfolioView;
	messages: PortfolioPageMessages;
	/** Shapes of the resume icons the page uses (`portfolioIconNames`), by name; missing ones are left out. */
	icons?: Readonly<Record<string, string>>;
	/** An image address as the page loads it; by default every address is used as given. */
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
	/** The page script, the same text on every page (allowed by hash). */
	script: string;
	/** A font file worth preloading. */
	preloadFont: string | null;
	/** The page background per mode, for the browser's `theme-color`. */
	themeColors: { light: string; dark: string };
};

/** The resume icons a view draws (service, metric and client icons), for the caller to load before rendering. */
export function portfolioIconNames(view: PortfolioView): string[] {
	const names = new Set<string>();
	const metrics = [
		...view.hero.highlights,
		...view.works.flatMap((work) => work.blocks.flatMap((block) => (block.type === "metrics" ? block.items : []))),
	];
	for (const metric of metrics) if (metric.icon) names.add(metric.icon);
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
	const context: RenderContext = {
		view,
		messages: input.messages,
		locale: view.locale,
		icon: (name) => (name ? (input.icons?.[name] ?? null) : null),
		imageUrl: input.imageUrl ?? ((src) => src),
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
	const faces = portfolioFontFaces(view);
	return {
		lang: view.locale,
		dir: view.dir,
		scheme: view.design.scheme,
		html,
		head: hoisted,
		css: [fontFaceCss(faces), designCss(view, theme.palette), BASE_CSS, theme.css].join("\n"),
		script: PORTFOLIO_PAGE_SCRIPT,
		preloadFont: preloadFont(view, faces),
		themeColors: { light: theme.palette.light.bg, dark: theme.palette.dark.bg },
	};
}
