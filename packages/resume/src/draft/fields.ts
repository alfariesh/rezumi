/**
 * The keys of `current` whose values differ from `baseline` (compared as JSON), with their current values. Drafts send
 * only these to the server and overlay only these on its echo.
 */
export function changedFields<T extends object>(current: T, baseline: T): Partial<T> {
	const changes: Partial<T> = {};
	for (const key of Object.keys(current) as (keyof T)[]) {
		if (JSON.stringify(current[key]) !== JSON.stringify(baseline[key])) changes[key] = current[key];
	}
	return changes;
}
