import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { DocsArticle, DocsArticlePending, DocsNotFound } from "@/features/docs/article";
import { loadDocsModule, matchDocsPath } from "@/features/docs/content";
import { DOCS_HOME } from "@/features/docs/paths";
import { createNoindexFollowMeta, getDocsMeta } from "@/libs/seo";

export const Route = createFileRoute("/docs/$")({
	beforeLoad: ({ params, location }) => {
		const match = matchDocsPath(params._splat ?? "");
		if (!match) throw notFound();
		if ("redirectTo" in match) {
			// An old address keeps its section: /docs/guides/using-ai-agent#models → the page it moved to, #models.
			const hash = location.hash ? { hash: location.hash } : {};
			throw match.redirectTo === DOCS_HOME
				? redirect({ to: "/docs", ...hash, replace: true })
				: redirect({ to: "/docs/$", params: { _splat: match.redirectTo }, ...hash, replace: true });
		}
		return { docsPage: match.page };
	},
	loader: async ({ context }) => ({ page: context.docsPage, module: await loadDocsModule(context.docsPage.slug) }),
	head: ({ loaderData }) => {
		if (!loaderData) return { meta: [createNoindexFollowMeta()] };
		const { title, description } = getDocsMeta(loaderData.page);
		return { meta: [{ title }, { name: "description", content: description }] };
	},
	pendingComponent: DocsArticlePending,
	notFoundComponent: DocsNotFound,
	component: RouteComponent,
});

function RouteComponent() {
	const { page, module } = Route.useLoaderData();
	return <DocsArticle page={page} module={module} />;
}
