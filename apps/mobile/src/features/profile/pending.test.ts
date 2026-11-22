import { emptyProfileData } from "@rezumi/schema/profile/data";
import { clearPendingProfile, loadPendingProfile, storePendingProfile } from "./pending";

const memory = () => {
	const map = new Map<string, string>();
	return {
		map,
		getItemSync: (key: string) => map.get(key) ?? null,
		setItemSync: (key: string, value: string) => void map.set(key, value),
		removeItemSync: (key: string) => void map.delete(key),
	};
};

const version = new Date("2026-11-21T08:00:00.000Z");

describe("Profile edits kept on this device", () => {
	it("come back per account, under the prefix sign-out removes", () => {
		const storage = memory();
		const data = emptyProfileData();
		data.basics.name = "Dana";
		storePendingProfile(storage, "account-a", { data, updatedAt: version });
		expect([...storage.map.keys()]).toEqual(["rezumi:profile-pending:account-a:edits"]);
		expect(loadPendingProfile(storage, "account-a")).toEqual({ data, updatedAt: version });
		expect(loadPendingProfile(storage, "account-b")).toBeNull();
		clearPendingProfile(storage, "account-a");
		expect(storage.map.size).toBe(0);
	});

	it("ignore what they can't trust, and a failing store", () => {
		const storage = memory();
		storage.setItemSync("rezumi:profile-pending:a:edits", "{");
		expect(loadPendingProfile(storage, "a")).toBeNull();
		storage.setItemSync("rezumi:profile-pending:a:edits", JSON.stringify({ v: 1, data: { basics: 1 } }));
		expect(loadPendingProfile(storage, "a")).toBeNull();
		const broken = {
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
		expect(loadPendingProfile(broken, "a")).toBeNull();
		expect(() => storePendingProfile(broken, "a", { data: emptyProfileData(), updatedAt: null })).not.toThrow();
		expect(() => clearPendingProfile(broken, "a")).not.toThrow();
	});
});
