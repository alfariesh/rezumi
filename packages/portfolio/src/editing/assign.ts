import { isEqual } from "es-toolkit";

type Container = Record<string, unknown> | unknown[];

const isContainer = (value: unknown): value is Container => typeof value === "object" && value !== null;

const idOf = (value: unknown) =>
	isContainer(value) && !Array.isArray(value) && typeof value.id === "string" ? value.id : undefined;

/**
 * A list that grew, shrank or was reordered: items the change left as they were (found by id) keep their references,
 * so a work added beside others doesn't redraw the others.
 */
function keepUnchanged(previous: readonly unknown[], next: readonly unknown[]): unknown[] {
	return next.map((entry) => {
		const id = idOf(entry);
		const old = id === undefined ? undefined : previous.find((item) => idOf(item) === id);
		return old !== undefined && isEqual(old, entry) ? old : entry;
	});
}

/**
 * Writes `next` over `target`, an Immer draft of `before`, assigning only what differs. The parts the change left alone
 * keep their references, so the preview and the panels re-render what changed instead of the whole portfolio. (The
 * resume editor's WebMCP tools do the same; that module brings the resume editor with it, so this one stands alone.)
 */
export function assignChanged(target: Container, before: Container, next: Container): void {
	const draft = target as Record<string, unknown>;
	const previous = before as Record<string, unknown>;

	// Arrays only get here at equal lengths (see below), so only objects can lose keys.
	if (!Array.isArray(next)) for (const key of Object.keys(draft)) if (!Object.hasOwn(next, key)) delete draft[key];

	for (const [key, value] of Object.entries(next)) {
		const old = previous[key];
		if (isEqual(old, value)) continue;

		const sameShape =
			isContainer(old) &&
			isContainer(value) &&
			Array.isArray(old) === Array.isArray(value) &&
			(!Array.isArray(old) || old.length === (value as unknown[]).length);

		if (sameShape) assignChanged(draft[key] as Container, old, value);
		else if (Array.isArray(old) && Array.isArray(value)) draft[key] = keepUnchanged(old, value);
		else draft[key] = value;
	}
}
