import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { matchDocsPath } from "@/features/docs/content";
import { DocsLayout } from "@/features/docs/layout";
import { DOCS_HOME } from "@/features/docs/paths";

/** The public documentation: the MDX pages in the repository's docs/ folder (src/features/docs). */
export const Route = createFileRoute("/docs")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const splat = useParams({ strict: false, select: (params) => params._splat });
	const match = splat ? matchDocsPath(splat) : undefined;
	const slug = !splat ? DOCS_HOME : match && "page" in match ? match.page.slug : "";

	return (
		<DocsLayout slug={slug} signedIn={session !== null}>
			<Outlet />
		</DocsLayout>
	);
}
