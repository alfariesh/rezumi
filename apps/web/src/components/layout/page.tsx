import type { ReactNode } from "react";
import { createContext } from "react";
import { cn } from "@rezumi/utils/style";

/**
 * How wide a dashboard page may grow, by what it holds:
 * - `narrow` (720px): forms and settings, kept to a reading width.
 * - `default` (1440px): pages of widgets, wide enough for a main column beside a side column.
 * - `wide` (1920px): data that uses the room it gets: document grids and lists, the board, the calendar, charts.
 */
export type PageWidth = "narrow" | "default" | "wide";

const WIDTHS: Record<PageWidth, string> = {
	narrow: "max-w-[720px]",
	default: "max-w-[1440px]",
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
 * The column every dashboard page sits in: centred, capped at its width, with the shared margins. Rows stack 20px
 * apart; a page can change the gap or add a minimum height through `className`.
 */
export function Page({ width = "default", className, children }: PageProps) {
	return (
		<div className={cn("mx-auto flex w-full flex-col gap-5 py-5 sm:py-8", PAGE_GUTTER, WIDTHS[width], className)}>
			<InPageContext value>{children}</InPageContext>
		</div>
	);
}
