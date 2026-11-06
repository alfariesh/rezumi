/**
 * Mozaik's grid arithmetic, apart from the markup so it can be tested on its own: which tiles the intro bento has and
 * the grid areas they form at each width, and the spans that close the works bento without holes.
 */

/** The intro tiles that can be missing; the intro tile itself is always there. */
export type BentoTiles = {
	photo: boolean;
	/** Stat tiles: none, one (the accent tile) or two (accent and soft). */
	stats: 0 | 1 | 2;
	about: boolean;
	location: boolean;
	links: boolean;
};

export type BentoAreas = { wide: string; tablet: string; phone: string };

const areas = (rows: readonly (readonly string[])[]) => rows.map((row) => `"${row.join(" ")}"`).join(" ");

/**
 * The bento's `grid-template-areas` at desktop (4 columns), tablet (≤900 px, 2 columns) and phone (≤560 px, 2 columns),
 * from `01-desain.md` section 5: `"intro intro photo s1" "intro intro photo s2" "about about loc links"`. Missing
 * tiles hand their cells to their neighbours, so every combination still closes as a full rectangle: the intro widens
 * over a missing photo or stat column, About widens over a missing location or links tile, and so on.
 */
export function bentoAreas(tiles: BentoTiles): BentoAreas {
	const side = [...(tiles.photo ? ["photo"] : []), ...(tiles.stats ? ["s1"] : [])];
	const intro = Array.from({ length: 4 - side.length }, () => "intro");
	const lastStat = tiles.stats === 2 ? "s2" : "s1";
	const top: string[][] = side.length
		? [
				[...intro, ...side],
				[...intro, ...(tiles.photo ? ["photo"] : []), ...(tiles.stats ? [lastStat] : [])],
			]
		: [intro];

	const others = [...(tiles.location ? ["loc"] : []), ...(tiles.links ? ["links"] : [])];
	const bottom: string[][] = [];
	if (tiles.about) bottom.push([...Array.from({ length: 4 - others.length }, () => "about"), ...others]);
	else if (others.length === 2) bottom.push(["loc", "loc", "links", "links"]);
	else if (others.length === 1) bottom.push(Array.from({ length: 4 }, () => others[0] as string));

	const middle: string[][] = [];
	if (tiles.photo && tiles.stats === 2) middle.push(["photo", "s1"], ["photo", "s2"]);
	else if (tiles.photo && tiles.stats === 1) middle.push(["photo", "s1"]);
	else if (tiles.photo) middle.push(["photo", "photo"]);
	else if (tiles.stats === 2) middle.push(["s1", "s2"]);
	else if (tiles.stats === 1) middle.push(["s1", "s1"]);
	const narrowTop = [["intro", "intro"], ...middle];
	const about = tiles.about ? [["about", "about"]] : [];

	const tabletBottom = others.length === 2 ? [["loc", "links"]] : others.map((tile) => [tile, tile]);
	const phoneBottom = others.map((tile) => [tile, tile]);
	return {
		wide: areas([...top, ...bottom]),
		tablet: areas([...narrowTop, ...about, ...tabletBottom]),
		phone: areas([...narrowTop, ...about, ...phoneBottom]),
	};
}

/** A tile's size in grid cells: columns and rows. */
export type TileSpan = { columns: number; rows: number };

/**
 * Packs tiles into rows of `capacity` cells, in order: a tile that doesn't fit what is left of its row widens the
 * tile before it to close the row, and the last tile widens to close the last row, so no row is left with a hole.
 * Returns the row each tile lands in (counted from 0).
 */
function packRows(spans: TileSpan[], capacity: (row: number) => number): number[] {
	const rowOf: number[] = [];
	let row = 0;
	let used = 0;
	let previous = -1;
	spans.forEach((span, index) => {
		if (used > 0 && used + span.columns > capacity(row)) {
			(spans[previous] as TileSpan).columns += capacity(row) - used;
			row++;
			used = 0;
		}
		span.columns = Math.min(span.columns, capacity(row));
		rowOf[index] = row;
		used += span.columns;
		previous = index;
		if (used === capacity(row)) {
			row++;
			used = 0;
		}
	});
	if (used > 0 && previous >= 0) (spans[previous] as TileSpan).columns += capacity(row) - used;
	return rowOf;
}

/**
 * The works bento's spans at desktop (4 columns) and tablet (2 columns) for `count` tiles (works, then the "More on"
 * tile when there is one), from `01-desain.md` section 5: the first work 2 × 2, the sixth work and the closing tile
 * 2 × 1, the rest 1 × 1. With other counts the packing widens a tile here and there so the grid closes without holes.
 * Phones show one column, where spans don't apply.
 */
export function workSpans(count: number, wideAt: (index: number) => boolean): { wide: TileSpan; tablet: TileSpan }[] {
	if (count <= 0) return [];
	const base = (index: number): TileSpan => ({ columns: wideAt(index) ? 2 : 1, rows: 1 });

	// Desktop: the first work fills the left half of two rows; the right half of those rows holds 2 cells each, then
	// the rows below hold 4.
	const wide: TileSpan[] = Array.from({ length: count }, (_, index) => base(index));
	if (count === 1) wide[0] = { columns: 4, rows: 2 };
	else {
		wide[0] = { columns: 2, rows: 2 };
		const rest = wide.slice(1);
		const rowOf = packRows(rest, (row) => (row < 2 ? 2 : 4));
		// When the tiles beside the first work fill only its top row, they grow down to its bottom.
		if (rowOf.at(-1) === 0) for (const span of rest) span.rows = 2;
	}

	// Tablet: the first work spans both columns and two rows, then rows of 2 cells.
	const tablet: TileSpan[] = Array.from({ length: count }, (_, index) => base(index));
	tablet[0] = { columns: 2, rows: 2 };
	packRows(tablet.slice(1), () => 2);

	return wide.map((span, index) => ({ wide: span, tablet: tablet[index] as TileSpan }));
}
