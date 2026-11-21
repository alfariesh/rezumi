import type { KeyValueStorage, SavedOnboarding } from "./saved-run";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { clearSavedOnboarding, loadSavedOnboarding, parseSavedOnboarding, storeSavedOnboarding } from "./saved-run";

const memory = (): KeyValueStorage & { map: Map<string, string> } => {
	const map = new Map<string, string>();
	return {
		map,
		getItemSync: (key) => map.get(key) ?? null,
		setItemSync: (key, value) => void map.set(key, value),
		removeItemSync: (key) => void map.delete(key),
	};
};

const run: SavedOnboarding = {
	step: "review",
	inputs: { linkedin: "", linkedinOwn: false, github: "dewi-dev", website: "" },
	answers: { targetRoles: ["Product designer"], locations: ["Bandung"], maxOfficeDays: 2 },
	runs: {
		github: { status: "done", key: "dewi-dev", result: { data: emptyProfileData(), photoUrl: null, notes: [] } },
		website: { status: "loading", key: "https://dewi.design/" },
	},
	excluded: ["summary"],
	photo: null,
	template: "meridian",
	savedAt: null,
};

describe("a saved onboarding", () => {
	it("comes back per account, with only the finished sources", () => {
		const storage = memory();
		storeSavedOnboarding(storage, "account-a", run);
		const back = loadSavedOnboarding(storage, "account-a");
		expect(back?.step).toBe("review");
		expect(Object.keys(back?.runs ?? {})).toEqual(["github"]);
		expect(back?.answers).toEqual(run.answers);
		expect(back?.photo).toBeNull();
		expect(loadSavedOnboarding(storage, "account-b")).toBeNull();
		expect(loadSavedOnboarding(storage, null)).toBeNull();
	});

	it("is forgotten when cleared", () => {
		const storage = memory();
		storeSavedOnboarding(storage, "account-a", run);
		clearSavedOnboarding(storage, "account-a");
		expect(storage.map.size).toBe(0);
	});

	it("ignores what it can't trust", () => {
		expect(parseSavedOnboarding("{")).toBeNull();
		expect(parseSavedOnboarding(JSON.stringify({ ...run, v: 2 }))).toBeNull();
		expect(parseSavedOnboarding(JSON.stringify({ ...run, v: 1, step: "done" }))).toBeNull();
		expect(parseSavedOnboarding(JSON.stringify({ ...run, v: 1, template: "nope" }))).toBeNull();
		const odd = parseSavedOnboarding(
			JSON.stringify({ ...run, v: 1, answers: { targetRoles: [1, "UX"], maxOfficeDays: 9 }, photo: 3 }),
		);
		expect(odd?.answers).toEqual({ targetRoles: ["UX"], locations: [], maxOfficeDays: null });
		expect(odd && "photo" in odd).toBe(false);
	});

	it("keeps going when the store fails", () => {
		const broken: KeyValueStorage = {
			getItemSync: () => {
				throw new Error("disk");
			},
			setItemSync: () => {
				throw new Error("disk");
			},
			removeItemSync: () => {
				throw new Error("disk");
			},
		};
		expect(() => storeSavedOnboarding(broken, "a", run)).not.toThrow();
		expect(loadSavedOnboarding(broken, "a")).toBeNull();
		expect(() => clearSavedOnboarding(broken, "a")).not.toThrow();
	});
});
