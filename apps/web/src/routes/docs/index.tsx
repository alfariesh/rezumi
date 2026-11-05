import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsArticle, DocsArticlePending } from "@/features/docs/article";
import { getDocsPage, loadDocsModule } from "@/features/docs/content";
import { DOCS_HOME } from "@/features/docs/paths";
import { getDocsMeta } from "@/libs/seo";

export const Route = createFileRoute("/docs/")({
	loader: async () => {
		const page = getDocsPage(DOCS_HOME);
		if (!page) throw notFound();
		return { page, module: await loadDocsModule(DOCS_HOME) };
	},
	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const { title, description } = getDocsMeta(loaderData.page);
		return { meta: [{ title }, { name: "description", content: description }] };
	},
	pendingComponent: DocsArticlePending,
	component: RouteComponent,
});

function RouteComponent() {
	const { page, module } = Route.useLoaderData();
	return <DocsArticle page={page} module={module} />;
}
