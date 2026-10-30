// @vitest-environment happy-dom

import type { DocumentSummary } from "./filter";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { DocumentList } from "./document-list";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, Link: () => null }));
vi.mock("./document-actions", () => ({ DocumentMenuContent: () => null, useDocumentActions: () => ({}) }));
vi.mock("./resume-thumbnail", () => ({ ResumeThumbnail: () => null }));

const document = (id: string, name: string, overrides: Partial<DocumentSummary> = {}): DocumentSummary => ({
	type: "resume",
	id,
	name,
	tags: [],
	isLocked: false,
	isPublic: false,
	slug: null,
	trashedAt: null,
	createdAt: new Date("2026-10-01"),
	updatedAt: new Date("2026-10-02"),
	application: null,
	...overrides,
});

const documents = [document("a", "Product resume"), document("b", "Design resume")];

beforeEach(() => {
	navigate.mockReset();
	i18n.loadAndActivate({ locale: "en-US", messages: {} });
});

it("opens a row until something is selected, then toggles rows, with translated checkbox names", () => {
	const onSelectedChange = vi.fn();
	const view = render(
		<I18nProvider i18n={i18n}>
			<DocumentList
				documents={documents}
				label="Documents"
				onTags={vi.fn()}
				onLink={vi.fn()}
				selected={new Set()}
				onSelectedChange={onSelectedChange}
				sort="edited"
				onSortChange={vi.fn()}
			/>
		</I18nProvider>,
	);

	expect(screen.getByRole("checkbox", { name: "Select all" })).toBeInTheDocument();
	fireEvent.click(screen.getByRole("checkbox", { name: /^Select Product resume/ }));
	expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(["resume:a"]));

	fireEvent.click(screen.getByRole("rowheader", { name: /Design resume/ }));
	expect(navigate).toHaveBeenCalledWith({ to: "/builder/$resumeId", params: { resumeId: "b" } });

	view.rerender(
		<I18nProvider i18n={i18n}>
			<DocumentList
				documents={documents}
				label="Documents"
				onTags={vi.fn()}
				onLink={vi.fn()}
				selected={new Set(["resume:a"])}
				onSelectedChange={onSelectedChange}
			/>
		</I18nProvider>,
	);
	navigate.mockReset();
	fireEvent.click(screen.getByRole("rowheader", { name: /Design resume/ }));
	expect(navigate).not.toHaveBeenCalled();
	expect(onSelectedChange).toHaveBeenLastCalledWith(new Set(["resume:a", "resume:b"]));
});

it("lists Trash with the days left and no selection", () => {
	render(
		<I18nProvider i18n={i18n}>
			<DocumentList
				documents={[document("c", "Old letter", { type: "letter", trashedAt: new Date() })]}
				label="Trash"
				inTrash
				onTags={vi.fn()}
				onLink={vi.fn()}
			/>
		</I18nProvider>,
	);

	expect(screen.getByRole("columnheader", { name: "Deleted in" })).toBeInTheDocument();
	expect(screen.getByText("30 days left")).toBeInTheDocument();
	expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
