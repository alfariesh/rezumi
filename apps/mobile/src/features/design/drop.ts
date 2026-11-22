// Where a dragged section lands in the Layout screen: the drop zone under the finger, from rectangles measured when the
// drag starts. Pure: no React.
import type { LayoutDrop, LayoutLocation } from "@rezumi/resume/layout";

/** A column's window rectangle and its visible rows', without the row being dragged. */
export type DropZone = LayoutLocation & { top: number; bottom: number; rows: { top: number; bottom: number }[] };

/** The zone that holds window `y` (else the nearest), and the index of the first row whose middle is below it. */
export function dropAt(zones: readonly DropZone[], y: number): LayoutDrop | null {
	let best: DropZone | null = null;
	let distance = Number.POSITIVE_INFINITY;
	for (const zone of zones) {
		const gap = y < zone.top ? zone.top - y : y > zone.bottom ? y - zone.bottom : 0;
		if (gap < distance) {
			best = zone;
			distance = gap;
		}
	}
	if (!best) return null;
	const index = best.rows.filter((row) => (row.top + row.bottom) / 2 < y).length;
	return { page: best.page, column: best.column, index };
}
