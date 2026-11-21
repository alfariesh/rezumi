// The design-system guard (plans/mobile 02-teknis 9.1): screens, routes and shell code style through src/ui and the
// global.css tokens. A rebuilt file may not hold a hex color, a static inline style object, or a legacy import.
// Files not rebuilt yet are listed in design-guard.legacy.json; the list only shrinks.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import legacy from "./design-guard.legacy.json";

const root = join(__dirname, "..");
const scanned = ["src/features", "app", "src/shell", "src/dev"];

function sources(directory: string): string[] {
	return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
	});
}

const rules = [
	{ name: "hex color", pattern: /["']#[0-9a-fA-F]{3,8}["']/ },
	// Values computed at run time go in `style={value}` or `style={[…]}`; a literal object is a static style.
	{ name: "static style object (use className)", pattern: /style=\{\{/ },
	{ name: "legacy import (use @/ui)", pattern: /@\/ui-legacy/ },
];

const files = scanned.flatMap(sources).map((path) => relative(root, join(root, path)));
const allowed = new Set(legacy.files);

describe("design-system guard", () => {
	it.each(files.filter((file) => !allowed.has(file)))("%s uses src/ui and tokens only", (file) => {
		const source = readFileSync(join(root, file), "utf8");
		for (const rule of rules)
			expect({ file, rule: rule.name, found: rule.pattern.test(source) }).toMatchObject({ found: false });
	});

	it("lists only legacy files that still exist and still need the exception", () => {
		const existing = new Set(files);
		const stale = legacy.files.filter(
			(file) => !existing.has(file) || !rules.some((rule) => rule.pattern.test(readFileSync(join(root, file), "utf8"))),
		);
		expect(stale).toEqual([]);
	});

	it("keeps the legacy list sorted, so each phase's removals read clearly in review", () => {
		expect(legacy.files).toEqual([...legacy.files].sort());
	});
});
