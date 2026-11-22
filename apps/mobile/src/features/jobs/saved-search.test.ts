// The last results kept on this device for Jobs opened offline: per account, only what parses comes back.
import { jobsSearchSchema } from "@rezumi/career/jobs";
import { readSavedSearch, SAVED_JOB_SEARCH_PREFIX, writeSavedSearch } from "./saved-search";

const memory = () => {
	const items = new Map<string, string>();
	return {
		items,
		getItemSync: (key: string) => items.get(key) ?? null,
		setItemSync: (key: string, value: string) => void items.set(key, value),
		removeItemSync: (key: string) => void items.delete(key),
	};
};

const page = {
	listings: [],
	fetchedAt: "2026-11-22T08:00:00Z",
	fromCache: false,
	stale: false,
	budgetLimited: false,
	quota: { used: 1, max: 15, resetsAt: "2026-11-23T00:00:00Z" },
	tracked: {},
	matches: {},
};

describe("saved job search", () => {
	it("comes back for the same account only", () => {
		const storage = memory();
		const search = jobsSearchSchema.parse({ q: "Nurse" });
		writeSavedSearch("scope-a", search, [page, page, page, page], storage);
		expect([...storage.items.keys()][0]?.startsWith(SAVED_JOB_SEARCH_PREFIX)).toBe(true);
		const saved = readSavedSearch("scope-a", storage);
		expect(saved?.search.q).toBe("Nurse");
		expect(saved?.pages).toHaveLength(3);
		expect(readSavedSearch("scope-b", storage)).toBeNull();
		expect(readSavedSearch(null, storage)).toBeNull();
	});

	it("drops what doesn't parse", () => {
		const storage = memory();
		storage.setItemSync(
			`${SAVED_JOB_SEARCH_PREFIX}scope-a:last`,
			JSON.stringify({ search: {}, pages: [{}], savedAt: "x" }),
		);
		expect(readSavedSearch("scope-a", storage)).toBeNull();
		storage.setItemSync(`${SAVED_JOB_SEARCH_PREFIX}scope-a:last`, "not json");
		expect(readSavedSearch("scope-a", storage)).toBeNull();
	});
});
