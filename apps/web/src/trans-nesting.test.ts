import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

/*
 * A `<Trans>` inside another `<Trans>` gets a different message from `lingui extract` than from the Vite build, so the
 * build asks for an id the catalog doesn't have and a production page shows the raw id (`LUh8an`) instead of its text.
 * Write one `<Trans>` around the whole sentence, links and icons included, and put the translator note on it:
 *
 *   <Trans comment="…">Already have an account? <Link>Sign in now <Icon /></Link></Trans>
 */

/** Every `<Trans>` that opens while another is still open, as "line N". */
export function findNestedTrans(source: string): string[] {
	const found: string[] = [];
	let depth = 0;
	for (const match of source.matchAll(/<Trans(?=[\s>/])[^>]*?(\/?)>|<\/Trans>/g)) {
		if (match[0] === "</Trans>") depth -= 1;
		else if (match[1] !== "/") {
			if (depth > 0) found.push(`line ${source.slice(0, match.index).split("\n").length}`);
			depth += 1;
		}
	}
	return found;
}

describe("findNestedTrans", () => {
	it("flags a Trans inside a Trans", () => {
		expect(findNestedTrans("<Trans>Hi <b><Trans comment='x'>there</Trans></b></Trans>")).toEqual(["line 1"]);
	});

	it("allows siblings, self-closing tags and a Trans inside other tags", () => {
		expect(findNestedTrans("<p><Trans>One</Trans> <Trans>Two</Trans></p>")).toEqual([]);
		expect(findNestedTrans("<Trans>Hi <Trans id='a' /></Trans>")).toEqual([]);
		expect(findNestedTrans("<Trans id='a' /><Trans>Two</Trans>")).toEqual([]);
	});
});

const SRC = fileURLToPath(new URL(".", import.meta.url));

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
	});
}

describe("apps/web/src", () => {
	it("has no Trans inside a Trans", () => {
		const violations = sourceFiles(SRC).flatMap((file) =>
			findNestedTrans(readFileSync(file, "utf8")).map((where) => `${relative(SRC, file)}: ${where}`),
		);

		expect(violations).toEqual([]);
	});
});
