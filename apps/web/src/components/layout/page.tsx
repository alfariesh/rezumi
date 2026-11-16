import type { ReactNode } from "react";
import { createContext } from "react";
import { cn } from "@rezumi/utils/style";

/**
 * How wide a dashboard page may grow, by what it holds:
 * - `narrow` (720px): forms and settings, kept to a reading width.
 * - `default` (1440px): pages of widgets, wide enough for a main column beside a side column.
 * - `wide` (1920px): data that uses the room it gets: document grids and lists, the board, the calendar, charts.
 */
type PageWidth = "narrow" | "default" | "wide";

/** A page's default width. The navbar's row uses it too, so its edges line up with the page under it on wide screens. */
export const PAGE_MAX_WIDTH = "max-w-[1440px]";

const WIDTHS: Record<PageWidth, string> = {
	narrow: "max-w-[720px]",
	default: PAGE_MAX_WIDTH,
	wide: "max-w-[1920px]",
};

/** A page's side margins: 16px on phones, 32px from 640px. The navbar uses the same, so its edges line up. */
export const PAGE_GUTTER = "px-4 sm:px-8";

/** True inside a `Page`: a section's layout (Career, Settings) is the page, and its child routes render inside it. */
export const InPageContext = createContext(false);

type PageProps = {
	width?: PageWidth;
	className?: string;
	children: ReactNode;
};

/**
 * The column every dashboard page sits in: centred, capped at its width, with the shared margins. From 768px its top
 * margin is 12px, so the title (and a section's menu) starts on the app sidebar's first row. Rows stack 20px apart; a
 * page can change the gap or add a minimum height through `className`.
 */
export function Page({ width = "default", className, children }: PageProps) {
	return (
		<div
			className={cn(
				"mx-auto flex w-full flex-col gap-5 pt-5 pb-5 sm:pb-8 md:pt-3",
				PAGE_GUTTER,
				WIDTHS[width],
				className,
			)}
		>
			<InPageContext value>{children}</InPageContext>
		</div>
	);
}
