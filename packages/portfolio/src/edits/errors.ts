/** An edit the engine refuses, with a message a model can act on. Other edits in the call still apply. */
export class PortfolioEditError extends Error {
	override name = "PortfolioEditError";
}

/** Refuses the edit being applied. */
export function refuse(message: string): never {
	throw new PortfolioEditError(message);
}

/** A write-schema issue, as much of it as the messages need (Zod's issue types, without depending on Zod here). */
export type SchemaIssue = {
	code: string;
	path: readonly PropertyKey[];
	message: string;
	origin?: string;
	maximum?: number | bigint;
	minimum?: number | bigint;
	expected?: string;
	values?: readonly unknown[];
	note?: string;
	discriminator?: string;
};

const DEFAULT_MESSAGE = /^(?:Invalid|Too big|Too small)\b/;

/** A short English reason for one issue: "at most 240 characters", "use one of: light, dark, auto". */
export function issueText(issue: SchemaIssue): string {
	// Messages the schema wrote itself ("Use an image uploaded to this portfolio.") say it best.
	if (!DEFAULT_MESSAGE.test(issue.message)) return issue.message;
	const unit = issue.origin === "string" ? " characters" : issue.origin === "array" ? " items" : "";
	switch (issue.code) {
		case "too_big":
			return `at most ${String(issue.maximum)}${unit}`;
		case "too_small":
			if (issue.origin === "string" && Number(issue.minimum) === 1) return "can't be empty";
			return `at least ${String(issue.minimum)}${unit}`;
		case "invalid_type":
			return issue.message.endsWith(" received undefined")
				? `required (${issue.expected ?? "a value"})`
				: `expected ${issue.expected ?? "another type"}`;
		case "invalid_value":
			return `use one of: ${(issue.values ?? []).map((value) => JSON.stringify(value)).join(", ")}`;
		case "invalid_union":
			return issue.discriminator
				? `"${issue.discriminator}" is missing or not one of the allowed values`
				: "doesn't match any of the allowed shapes";
		case "invalid_format":
			return "has the wrong format";
		default:
			return issue.message;
	}
}

/** A list item's name for a path: its title, name or label in quotes, a block by its type and id, else its place. */
function itemName(item: unknown, index: number): string {
	if (item && typeof item === "object") {
		const record = item as Record<string, unknown>;
		for (const field of ["title", "name", "label"]) {
			const value = record[field];
			if (typeof value === "string" && value.trim()) return `"${value.trim()}"`;
		}
		if (typeof record.type === "string") return `${record.type} block ${String(record.id ?? index + 1)}`;
		if (typeof record.id === "string") return `id ${record.id}`;
	}
	return `#${index + 1}`;
}

/**
 * A readable place in portfolio data: list items by their name, `items` arrays folded into their owner, so
 * `["works", "items", 2, "summary"]` reads `works › "Lumen" › summary`.
 */
export function describePath(data: unknown, path: readonly PropertyKey[]): string {
	const parts: string[] = [];
	let node: unknown = data;
	path.forEach((key, index) => {
		const child = node && typeof node === "object" ? (node as Record<PropertyKey, unknown>)[key] : undefined;
		if (Array.isArray(node) && typeof key === "number") parts.push(itemName(child, key));
		else if (!(key === "items" && Array.isArray(child) && typeof path[index + 1] === "number")) parts.push(String(key));
		node = child;
	});
	return parts.join(" › ") || "the portfolio";
}

/** The issues of a failed write check as one message: the first few, each with its readable place. */
export function describeIssues(data: unknown, issues: readonly SchemaIssue[], known?: ReadonlySet<string>): string {
	const shown = issues.slice(0, 3).map((issue) => {
		const text = `${describePath(data, issue.path)}: ${issueText(issue)}`;
		return known?.has(issueKey(issue)) ? `${text} (already wrong before this edit: fix it first)` : text;
	});
	const more = issues.length > shown.length ? ` (and ${issues.length - shown.length} more)` : "";
	return `${shown.join("; ")}${more}`;
}

/** What identifies an issue across two checks of the data: its place and its kind. */
export function issueKey(issue: SchemaIssue): string {
	return `${issue.path.map(String).join(".")}|${issue.code}`;
}
