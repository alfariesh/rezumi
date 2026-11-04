// @vitest-environment happy-dom

import type { DocumentSummary } from "./filter";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecentDocuments } from "./recent-documents";

const { api, openDialog } = vi.hoisted(() => ({
	api: { documents: [] as unknown[], fail: false },
	openDialog: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("./document-card", () => ({
	OpenLink: ({ document, children }: { document: DocumentSummary; children: ReactNode }) => (
		<a href={`/${document.type}/${document.id}`}>{children}</a>
	),
	LetterThumbnail: () => null,
}));
vi.mock("./resume-thumbnail", () => ({ ResumeThumbnail: () => null }));
vi.mock("@/dialogs/store", () => ({
	useDialogStore: (select: (state: { openDialog: typeof openDialog }) => unknown) => select({ openDialog }),
}));
vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		documents: {
			list: {
				queryOptions: () => ({
					queryKey: ["documents", "list"],
					queryFn: () => (api.fail ? Promise.reject(new Error("offline")) : Promise.resolve(api.documents)),
				}),
			},
		},
	},
}));

const document = (id: string, name: string, updatedAt: string, type: "resume" | "letter" = "resume") => ({
	type,
	id,
	name,
	tags: [],
	isLocked: false,
	isPublic: false,
	slug: null,
	trashedAt: null,
	createdAt: new Date("2026-10-01"),
	updatedAt: new Date(updatedAt),
	application: null,
});

const clients: QueryClient[] = [];
const mount = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	clients.push(client);
	return render(
		<QueryClientProvider client={client}>
			<I18nProvider i18n={i18n}>
				<RecentDocuments />
			</I18nProvider>
		</QueryClientProvider>,
	);
};

beforeEach(() => {
	api.documents = [];
	api.fail = false;
	openDialog.mockReset();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});
afterEach(() => {
	cleanup();
	clients.splice(0).forEach((client) => client.clear());
});

it("previews the three documents edited last, newest first, then a tile to start a new one", async () => {
	api.documents = [
		document("old", "Oldest resume", "2026-10-01"),
		document("new", "Newest resume", "2026-10-04"),
		document("letter", "A letter", "2026-10-03", "letter"),
		document("mid", "Middle resume", "2026-10-02"),
	];
	mount();

	const links = await screen.findAllByRole("link");
	expect(links.map((link) => link.textContent)).toEqual([
		"All documents",
		expect.stringContaining("Newest resume"),
		expect.stringContaining("A letter"),
		expect.stringContaining("Middle resume"),
	]);
	expect(screen.queryByText("Oldest resume")).toBeNull();
	expect(screen.getByText(/^Cover letter · /)).toBeInTheDocument();

	fireEvent.click(screen.getByRole("button", { name: "New document" }));
	expect(openDialog).toHaveBeenCalledWith("document.new", undefined);
});

it("offers a retry when the documents fail to load", async () => {
	api.fail = true;
	mount();
	expect(await screen.findByText("Couldn't load documents")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
