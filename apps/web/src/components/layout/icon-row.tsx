import type { ReactNode } from "react";
import { Separator } from "@heroui/react";
import { cn } from "@rezumi/utils/style";

type RowIconProps = { children: ReactNode; className?: string };

/**
 * The 40px tile a list row starts with: a glyph, a logo or an initial. Rows are flat (no card, no gray block) and
 * rules between them start under the text, past the tile and a 12px gap (`RowSeparator`).
 */
export function RowIcon({ children, className }: RowIconProps) {
	return (
		<span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-default", className)}>
			{children}
		</span>
	);
}

type RowSeparatorProps = { className?: string };

/** The rule between two rows that start with a `RowIcon`: it starts under the text and ends at the row's edge. */
export function RowSeparator({ className }: RowSeparatorProps) {
	return <Separator className={cn("ms-row-indent w-auto", className)} />;
}
