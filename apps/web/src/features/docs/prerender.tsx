/**
 * Renders every docs page to HTML at build time (`prerenderPages` in vite.config.ts), so a page's words are in the first
 * response and search engines read them without running the app. The pages are written in English, so they render
 * once, in English; the app then renders the live page in its place in the visitor's language.
 */
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterContextProvider } from "@tanstack/react-router";
import { I18nProvider as AriaI18nProvider } from "react-aria-components";
import { renderToString } from "react-dom/server";
import { defaultLocale } from "@rezumi/utils/locale";
import { DocsArticle } from "./article";
import { docsGroups, getDocsPage, loadDocsModule } from "./content";
import { DocsLayout } from "./layout";
import { docsPath } from "./paths";
import { ThemeProvider } from "@/features/theme/provider";
import { getLocaleMessages } from "@/libs/locale";
import { getDocsMeta } from "@/libs/seo";

/** Every published page, in reading order. */
export const docsSlugs = docsGroups.flatMap((group) => group.slugs);

export async function renderDocsPage(slug: string) {
	const page = getDocsPage(slug);
	if (!page) throw new Error(`No docs page "${slug}"`);
	const module = await loadDocsModule(slug);
	const { messages } = await getLocaleMessages(defaultLocale);
	i18n.loadAndActivate({ locale: defaultLocale, messages });

	const path = docsPath(slug);
	// Links only need a router to build their hrefs; nothing is loaded or navigated.
	const router = createRouter({
		routeTree: createRootRoute(),
		history: createMemoryHistory({ initialEntries: [path] }),
	});

	const html = renderToString(
		<RouterContextProvider router={router}>
			<I18nProvider i18n={i18n}>
				<ThemeProvider theme="system">
					<AriaI18nProvider locale={defaultLocale}>
						<DocsLayout slug={slug} signedIn={false}>
							<DocsArticle page={page} module={module} />
						</DocsLayout>
					</AriaI18nProvider>
				</ThemeProvider>
			</I18nProvider>
		</RouterContextProvider>,
	);

	return { path, html, locale: defaultLocale, ...getDocsMeta(page) };
}
