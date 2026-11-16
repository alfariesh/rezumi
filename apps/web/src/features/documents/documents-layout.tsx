import type { DocumentsSearch } from "./documents-page";
import type { DocumentTypeFilter } from "./filter";
import type { SectionNavItem } from "@/components/layout/section-layout";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { SectionLayout } from "@/components/layout/section-layout";
import { orpc } from "@/libs/orpc/client";

type DocumentsLayoutProps = {
	/** The menu item the page is: a type of the library, or Trash. */
	current: DocumentTypeFilter | "trash";
	/** The library's search, kept when switching type (search, tags, sort and view stay). */
	search?: DocumentsSearch | undefined;
	children: ReactNode;
};

/**
 * Documents: the library by type (All, Resumes, Letters) and Trash in one section menu. The types differ only by
 * `?type=`, so the page says which item is current.
 */
export function DocumentsLayout({ current, search, children }: DocumentsLayoutProps) {
	const { data: counts } = useQuery(orpc.documents.counts.queryOptions());

	const typeItem = (type: DocumentTypeFilter, icon: SectionNavItem["icon"], label: string, count?: number) =>
		({
			link: { to: "/dashboard/documents", search: { ...search, type } },
			match: { to: "/dashboard/documents", fuzzy: false },
			current: current === type,
			icon,
			label,
			count,
		}) satisfies SectionNavItem;

	const items: SectionNavItem[] = [
		typeItem("all", "books", t`All`, counts && counts.resume + counts.letter),
		typeItem("resume", "file-text", t`Resumes`, counts?.resume),
		typeItem("letter", "envelope-simple", t`Letters`, counts?.letter),
		{
			link: { to: "/dashboard/trash" },
			match: { to: "/dashboard/trash", fuzzy: false },
			current: current === "trash",
			icon: "trash",
			label: t`Trash`,
			count: counts?.trash,
		},
	];

	return (
		<SectionLayout title={t`Documents`} items={items}>
			{children}
		</SectionLayout>
	);
}
