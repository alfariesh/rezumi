import { readdirSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import catalog from "../catalog.json";
import { appIcons, getAppIcon, type AppIconName } from "./index";

const names = Object.keys(appIcons) as AppIconName[];

describe("app icons", () => {
	it("draws every app icon from standard stroke data", () => {
		for (const name of names) {
			const nodes = getAppIcon(name);
			expect(nodes.length, name).toBeGreaterThan(0);
			for (const [, attributes] of nodes)
				expect(attributes.stroke === "currentColor" || attributes.fill === "currentColor", name).toBe(true);
		}
	});

	it("gives every app icon a duotone twin that differs from the stroke glyph", () => {
		const withoutTwin = names.filter((name) => !appIcons[name].duotone);
		expect(withoutTwin).toEqual([]);
		expect(getAppIcon("house", "duotone")).not.toEqual(getAppIcon("house"));
	});

	it("keeps the catalog and the staged SVG files in step", () => {
		const staged = new Set(
			readdirSync(new URL("../svg/stroke-standard", import.meta.url)).map((file) => file.slice(0, -4)),
		);
		for (const hugeicons of Object.values(catalog.app)) expect(staged.has(hugeicons), hugeicons).toBe(true);
		expect(Object.keys(catalog.app).sort()).toEqual([...names].sort());
	});
});
