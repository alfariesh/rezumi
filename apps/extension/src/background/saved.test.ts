import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SETTINGS } from "../shared/storage";
import { lookupSaved, pageState, toSavedKeys, withSaved } from "./saved";

const origin = "https://rezumi.app";
const rows = [
	{ key: "linkedin:1", id: "newer", status: "applied" },
	{ key: "linkedin:1", id: "older", status: "saved" },
	{ key: "glints:abc", id: "g", status: "saved" },
];

describe("saved keys", () => {
	it("keeps the newest application per key and matches only this server's copy", () => {
		const saved = toSavedKeys(origin, rows, 1);
		expect(saved.keys["linkedin:1"]).toEqual({ id: "newer", status: "applied" });
		expect(lookupSaved(saved, origin, "linkedin:1")?.id).toBe("newer");
		expect(lookupSaved(saved, "http://localhost:3000", "linkedin:1")).toBeNull();
		expect(lookupSaved(saved, origin, null)).toBeNull();
		expect(lookupSaved(saved, origin, "linkedin:2")).toBeNull();
	});

	it("records a save at once, starting a copy for this server when there is none", () => {
		const saved = withSaved(null, origin, "indeed:x", { id: "i", status: "saved" });
		expect(saved).toMatchObject({ origin, keys: { "indeed:x": { id: "i", status: "saved" } } });
		expect(withSaved(saved, origin, "indeed:x", { id: "i", status: "interview" }).keys["indeed:x"]?.status).toBe(
			"interview",
		);
	});
});

describe("pageState", () => {
	const saved = toSavedKeys(origin, rows);
	const base = { settings: DEFAULT_SETTINGS, connected: true, saved, origin, uiLanguage: "en-US" };

	it("shows the button on a board posting, with the saved application when connected", () => {
		expect(pageState({ ...base, page: { site: "linkedin", key: "linkedin:1" } })).toEqual({
			button: true,
			floating: true,
			connected: true,
			saved: { id: "newer", status: "applied" },
			locale: "en",
		});
	});

	it("shows it before connecting too, without marks (aturan turunan #5)", () => {
		expect(pageState({ ...base, connected: false, page: { site: "linkedin", key: "linkedin:1" } })).toMatchObject({
			button: true,
			connected: false,
			saved: null,
		});
	});

	it("hides it when turned off, off a posting, off the boards, and floats it only where not closed", () => {
		const off = { ...DEFAULT_SETTINGS, pageButton: false };
		expect(pageState({ ...base, settings: off, page: { site: "linkedin", key: "linkedin:1" } }).button).toBe(false);
		expect(pageState({ ...base, page: { site: "linkedin", key: null } }).button).toBe(false);
		expect(pageState({ ...base, page: { site: null, key: "url:acme.example/jobs/1" } }).button).toBe(false);
		const closed = { ...DEFAULT_SETTINGS, floatingHidden: ["indeed"] };
		expect(pageState({ ...base, settings: closed, page: { site: "indeed", key: "indeed:x" } }).floating).toBe(false);
	});

	it("speaks the extension's language setting, else the browser's", () => {
		const page = { site: "glints" as const, key: "glints:abc" };
		expect(pageState({ ...base, uiLanguage: "id", page }).locale).toBe("id");
		expect(
			pageState({ ...base, uiLanguage: "id", settings: { ...DEFAULT_SETTINGS, language: "en" }, page }).locale,
		).toBe("en");
	});
});
