import type { LibraryDocument } from "./documents";
import { describe, expect, it } from "vite-plus/test";
import {
	changedTags,
	collectTags,
	daysLeftInTrash,
	documentKey,
	filterDocuments,
	isFiltered,
	sharedTags,
} from "./documents";

const doc = (patch: Partial<LibraryDocument> & Pick<LibraryDocument, "id" | "name">): LibraryDocument => ({
	type: "resume",
	tags: [],
	isPublic: false,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
	application: null,
	...patch,
});

const designer = doc({
	id: "1",
	name: "Designer 10",
	tags: ["design", "remote"],
	isPublic: true,
	createdAt: new Date("2026-03-01T00:00:00Z"),
	updatedAt: new Date("2026-05-01T00:00:00Z"),
	application: { company: "Acme", role: "Product designer" },
});
const engineer = doc({
	id: "2",
	name: "designer 9",
	tags: ["remote"],
	createdAt: new Date("2026-04-01T00:00:00Z"),
	updatedAt: new Date("2026-02-01T00:00:00Z"),
});
const letter = doc({
	id: "1",
	type: "letter",
	name: "Letter to Globex",
	createdAt: new Date("2026-02-01T00:00:00Z"),
	updatedAt: new Date("2026-06-01T00:00:00Z"),
});
const all = [designer, engineer, letter];
const base = { type: "all", q: "", tags: [], sort: "edited" } as const;

describe("filterDocuments", () => {
	it("sorts by last edit, creation date or name (numbers in order, case ignored)", () => {
		expect(filterDocuments(all, base).map((item) => item.name)).toEqual([
			"Letter to Globex",
			"Designer 10",
			"designer 9",
		]);
		expect(filterDocuments(all, { ...base, sort: "created" }).map(documentKey)).toEqual([
			"resume:2",
			"resume:1",
			"letter:1",
		]);
		expect(filterDocuments(all, { ...base, sort: "name" }).map((item) => item.name)).toEqual([
			"designer 9",
			"Designer 10",
			"Letter to Globex",
		]);
	});

	it("keeps a type, every chosen tag and Public", () => {
		expect(filterDocuments(all, { ...base, type: "letter" })).toEqual([letter]);
		expect(filterDocuments(all, { ...base, tags: ["remote"] })).toEqual([designer, engineer]);
		expect(filterDocuments(all, { ...base, tags: ["remote", "design"] })).toEqual([designer]);
		expect(filterDocuments(all, { ...base, public: true })).toEqual([designer]);
	});

	it("searches names, tags and the linked application, ignoring case and spaces around", () => {
		expect(filterDocuments(all, { ...base, q: "  ACME " })).toEqual([designer]);
		expect(filterDocuments(all, { ...base, q: "product" })).toEqual([designer]);
		expect(filterDocuments(all, { ...base, q: "remote" })).toEqual([designer, engineer]);
		expect(filterDocuments(all, { ...base, q: "globex" })).toEqual([letter]);
		expect(filterDocuments(all, { ...base, q: "nothing" })).toEqual([]);
	});

	it("leaves the input untouched", () => {
		const input = [...all];
		filterDocuments(input, { ...base, sort: "name" });
		expect(input).toEqual(all);
	});
});

describe("tags", () => {
	it("lists every tag once, alphabetically", () => {
		expect(collectTags(all)).toEqual(["design", "remote"]);
		expect(collectTags([])).toEqual([]);
	});

	it("finds the tags a group shares", () => {
		expect(sharedTags([designer, engineer])).toEqual(["remote"]);
		expect(sharedTags([designer])).toEqual(["design", "remote"]);
		expect(sharedTags([])).toEqual([]);
	});

	it("changes only the shared tags and keeps each document's own", () => {
		const shared = ["remote"];
		const next = ["hybrid"];
		expect(changedTags(designer, shared, next)).toEqual(["design", "hybrid"]);
		expect(changedTags(engineer, shared, next)).toEqual(["hybrid"]);
		// A tag added that a document already has is not doubled.
		expect(changedTags(designer, [], ["design"])).toEqual(["design", "remote"]);
	});
});

describe("isFiltered", () => {
	it("is true for a search, a tag or Public", () => {
		expect(isFiltered({ q: " ", tags: [] })).toBe(false);
		expect(isFiltered({ q: "a", tags: [] })).toBe(true);
		expect(isFiltered({ q: "", tags: ["x"] })).toBe(true);
		expect(isFiltered({ q: "", tags: [], public: true })).toBe(true);
	});
});

describe("daysLeftInTrash", () => {
	it("counts whole days up to 30 and never below 0", () => {
		const trashedAt = new Date("2026-01-01T00:00:00Z");
		expect(daysLeftInTrash(trashedAt, trashedAt.getTime())).toBe(30);
		expect(daysLeftInTrash(trashedAt, trashedAt.getTime() + 1)).toBe(30);
		expect(daysLeftInTrash(trashedAt, trashedAt.getTime() + 29.5 * 86_400_000)).toBe(1);
		expect(daysLeftInTrash(trashedAt, trashedAt.getTime() + 40 * 86_400_000)).toBe(0);
	});
});
