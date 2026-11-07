import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { RESERVED_PROFILE_SEGMENTS, RESERVED_SEGMENTS } from "./app-paths";

describe("RESERVED_PROFILE_SEGMENTS", () => {
	it("holds the app's own segments and every file at the root of the web app's public folder", () => {
		for (const segment of RESERVED_SEGMENTS) expect(RESERVED_PROFILE_SEGMENTS.has(segment), segment).toBe(true);
		// The static handler answers these before any username's page, so a username like them would never be reached.
		const publicFolder = fileURLToPath(new URL("../../../apps/web/public/", import.meta.url));
		const rootFiles = readdirSync(publicFolder, { withFileTypes: true }).filter((entry) => entry.isFile());
		for (const file of rootFiles) expect(RESERVED_PROFILE_SEGMENTS.has(file.name), file.name).toBe(true);
	});
});
