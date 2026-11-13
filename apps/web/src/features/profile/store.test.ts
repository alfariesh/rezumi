// @vitest-environment happy-dom

import type { ProfileData } from "@rezumi/schema/profile/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { ORPCError } from "@orpc/client";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { hasUnsavedProfileChanges, profileWriteSource, saveProfileNow, useProfileDraftStore } from "./store";

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const toastMocks = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@/libs/orpc/client", () => ({
	client: { profile: { get: api.get, update: api.update } },
	orpc: {
		profile: { get: { queryKey: () => ["profile"] } },
		documents: { key: () => ["documents"] },
		resume: { getById: { queryKey: () => ["resume"] } },
	},
}));
vi.mock("@rezumi/ui/components/toast", () => ({ toast: toastMocks }));

const profileWith = (name: string): ProfileData => {
	const data = emptyProfileData();
	data.basics.name = name;
	return data;
};

const version = new Date("2026-11-13T08:00:00.000Z");

beforeEach(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
	vi.useFakeTimers();
	useProfileDraftStore.getState().load({ data: profileWith("Dana"), updatedAt: version });
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe("the Profile's editor store", () => {
	it("shows the Profile to the Write forms as resume data", () => {
		const data = profileWriteSource.read(useProfileDraftStore.getState());
		expect(data?.basics.name).toBe("Dana");
		expect(data?.sections.experience.items).toEqual([]);
	});

	it("saves an edit as Profile data with the version it read", async () => {
		const saved = new Date("2026-11-13T09:00:00.000Z");
		api.update.mockResolvedValue({
			data: profileWith("Dana Putri"),
			updatedAt: saved,
			updatedResumes: [{ id: "r1", name: "CV" }],
		});

		profileWriteSource.update((draft) => {
			draft.basics.name = "Dana Putri";
		});
		expect(hasUnsavedProfileChanges()).toBe(true);
		await expect(saveProfileNow()).resolves.toBe(true);

		expect(api.update).toHaveBeenCalledOnce();
		const [input] = api.update.mock.calls[0] as [{ data: ProfileData; expectedUpdatedAt: Date | null }];
		expect(input.expectedUpdatedAt).toBe(version);
		expect(input.data.basics.name).toBe("Dana Putri");
		expect(input.data).not.toHaveProperty("metadata");
		const state = useProfileDraftStore.getState();
		expect(state.updatedAt).toBe(saved);
		expect(state.status).toBe("saved");
		expect(state.followed).toEqual([{ id: "r1", name: "CV" }]);
		expect(hasUnsavedProfileChanges()).toBe(false);
	});

	it("reloads the Profile when it was saved elsewhere meanwhile", async () => {
		api.update.mockRejectedValue(new ORPCError("PROFILE_VERSION_CONFLICT", { status: 409 }));
		const newer = new Date("2026-11-13T10:00:00.000Z");
		api.get.mockResolvedValue({ data: profileWith("Dana from another tab"), updatedAt: newer });

		profileWriteSource.update((draft) => {
			draft.basics.name = "Dana here";
		});
		await expect(saveProfileNow()).resolves.toBe(false);

		const state = useProfileDraftStore.getState();
		expect(state.data?.basics.name).toBe("Dana from another tab");
		expect(state.updatedAt).toBe(newer);
		expect(toastMocks.add).toHaveBeenCalledWith(expect.objectContaining({ id: "profile-conflict" }));
		expect(hasUnsavedProfileChanges()).toBe(false);
	});

	it("keeps the edit and offers Retry when saving fails", async () => {
		api.update.mockRejectedValue(new Error("offline"));
		profileWriteSource.update((draft) => {
			draft.basics.headline = "Designer";
		});
		await expect(saveProfileNow()).resolves.toBe(false);

		expect(useProfileDraftStore.getState().status).toBe("error");
		expect(useProfileDraftStore.getState().data?.basics.headline).toBe("Designer");
		expect(hasUnsavedProfileChanges()).toBe(true);
	});

	it("undoes an edit as one step", () => {
		profileWriteSource.update(
			(draft) => {
				draft.basics.location = "Bandung";
			},
			{ newStep: true },
		);
		profileWriteSource.undo();
		expect(useProfileDraftStore.getState().data?.basics.location).toBe("");
	});
});
