// The Profile editor's store on a phone (plans/mobile Phase 06): saves with the version it read, keeps edits through a
// failed save, and asks which version to keep after a conflict instead of dropping the edits.
import type { ProfileData } from "@rezumi/schema/profile/data";
import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import {
	closeProfile,
	hasUnsavedProfileChanges,
	openProfile,
	resolveProfileConflict,
	retryProfileSave,
	saveProfileNow,
	undoProfile,
	updateProfile,
	useProfileEditor,
} from "./store";

const mockApi = { get: jest.fn(), update: jest.fn() };

jest.mock("@/api/client", () => ({
	client: {
		profile: {
			get: (...args: unknown[]) => mockApi.get(...args),
			update: (...args: unknown[]) => mockApi.update(...args),
		},
	},
	orpc: { documents: { key: () => ["documents"] } },
}));
jest.mock("@/features/onboarding/queries", () => ({
	profileQuery: (server: string) => ({ queryKey: ["profile", server] }),
	storeSavedProfile: jest.fn(),
}));

const SERVER = "https://rezumi.app";
const version = new Date("2026-11-21T08:00:00.000Z");
const later = new Date("2026-11-21T09:00:00.000Z");

const profileWith = (name: string): ProfileData => {
	const data = emptyProfileData();
	data.basics.name = name;
	return data;
};

const rename = (name: string) =>
	updateProfile(
		(draft) => {
			draft.basics.name = name;
		},
		{ coalesceKey: "basics.name" },
	);

beforeEach(() => {
	jest.clearAllMocks();
	closeProfile();
	openProfile({ data: profileWith("Dana"), updatedAt: version }, SERVER, new QueryClient());
});

describe("the Profile editor store", () => {
	it("opens the Profile as resume data for the entry forms", () => {
		const { data, server } = useProfileEditor.getState();
		expect(server).toBe(SERVER);
		expect(data?.basics.name).toBe("Dana");
		expect(data?.sections.experience.items).toEqual([]);
	});

	it("saves an edit as Profile data with the version it read", async () => {
		mockApi.update.mockResolvedValue({
			data: profileWith("Dana Putri"),
			updatedAt: later,
			updatedResumes: [{ id: "r1", name: "Product CV" }],
		});
		rename("Dana Putri");
		expect(hasUnsavedProfileChanges()).toBe(true);
		await expect(saveProfileNow()).resolves.toBe(true);

		const [input] = mockApi.update.mock.calls[0] as [{ data: ProfileData; expectedUpdatedAt: Date | null }];
		expect(input.expectedUpdatedAt).toBe(version);
		expect(input.data.basics.name).toBe("Dana Putri");
		const state = useProfileEditor.getState();
		expect(state.updatedAt).toBe(later);
		expect(state.status).toBe("saved");
		expect(state.followed).toEqual([{ id: "r1", name: "Product CV" }]);
		expect(hasUnsavedProfileChanges()).toBe(false);
	});

	it("keeps the edit when offline and sends it on retry", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		mockApi.update.mockResolvedValueOnce({ data: profileWith("Dana P"), updatedAt: later, updatedResumes: [] });
		rename("Dana P");
		await expect(saveProfileNow()).resolves.toBe(false);
		expect(useProfileEditor.getState().status).toBe("error");
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana P");
		expect(hasUnsavedProfileChanges()).toBe(true);

		await expect(retryProfileSave()).resolves.toBe(true);
		expect(useProfileEditor.getState().status).toBe("saved");
	});

	it("asks which version to keep after a conflict, and keeping mine sends over the newer version", async () => {
		mockApi.update.mockRejectedValueOnce(new ORPCError("PROFILE_VERSION_CONFLICT", { status: 409 }));
		mockApi.get.mockResolvedValue({ data: profileWith("Dana from the web"), updatedAt: later });
		rename("Dana on the phone");
		await expect(saveProfileNow()).resolves.toBe(false);

		const state = useProfileEditor.getState();
		expect(state.conflict?.data.basics.name).toBe("Dana from the web");
		expect(state.data?.basics.name).toBe("Dana on the phone");
		// While the choice is open, edits wait.
		rename("ignored");
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana on the phone");

		mockApi.update.mockResolvedValueOnce({
			data: profileWith("Dana on the phone"),
			updatedAt: new Date("2026-11-21T10:00:00.000Z"),
			updatedResumes: [],
		});
		await resolveProfileConflict("keep-mine");
		const [input] = mockApi.update.mock.calls[1] as [{ data: ProfileData; expectedUpdatedAt: Date | null }];
		expect(input.expectedUpdatedAt).toBe(later);
		expect(input.data.basics.name).toBe("Dana on the phone");
		expect(useProfileEditor.getState().conflict).toBeNull();
	});

	it("shows the saved version when the person picks it", async () => {
		mockApi.update.mockRejectedValueOnce(new ORPCError("PROFILE_VERSION_CONFLICT", { status: 409 }));
		mockApi.get.mockResolvedValue({ data: profileWith("Dana from the web"), updatedAt: later });
		rename("Dana on the phone");
		await saveProfileNow();
		await resolveProfileConflict("use-theirs");

		const state = useProfileEditor.getState();
		expect(state.data?.basics.name).toBe("Dana from the web");
		expect(state.updatedAt).toBe(later);
		expect(state.conflict).toBeNull();
		expect(hasUnsavedProfileChanges()).toBe(false);
	});

	it("keeps unsent edits when a fresh read arrives, and takes a newer read otherwise", () => {
		rename("Dana typing");
		openProfile({ data: profileWith("Dana elsewhere"), updatedAt: later }, SERVER, new QueryClient());
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana typing");

		closeProfile();
		openProfile({ data: profileWith("Dana"), updatedAt: version }, SERVER, new QueryClient());
		openProfile({ data: profileWith("Dana elsewhere"), updatedAt: later }, SERVER, new QueryClient());
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana elsewhere");
	});

	it("undoes an edit as one step", () => {
		updateProfile(
			(draft) => {
				draft.basics.location = "Bandung";
			},
			{ newStep: true },
		);
		undoProfile();
		expect(useProfileEditor.getState().data?.basics.location).toBe("");
	});
});
