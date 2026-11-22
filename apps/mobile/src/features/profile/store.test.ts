// The Profile editor's store on a phone (plans/mobile Phase 06): saves with the version it read, keeps edits through a
// failed save (on this device too), asks which version to keep after a conflict instead of dropping the edits, and
// keeps one account's Profile away from another's.
import type { ProfileData } from "@rezumi/schema/profile/data";
import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { clearPendingProfile, loadPendingProfile } from "./pending";
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
const SERVER = "https://rezumi.app";
const ACCOUNT_A = JSON.stringify([SERVER, "user-a"]);
const ACCOUNT_B = JSON.stringify([SERVER, "user-b"]);
const mockSession = {
	status: "signed-in" as "signed-in" | "signed-out" | "expired",
	scope: ACCOUNT_A as string | null,
};

// The store subscribes when it's imported, before this file's constants exist: the listeners live in the mock.
jest.mock("@/auth/session", () => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		getSession: () => ({ status: mockSession.status, server: "https://rezumi.app" }),
		getAccountScope: () => (mockSession.status === "signed-in" ? mockSession.scope : null),
		subscribeSession: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
});

/** The session moving on, as src/auth/session.ts reports it. */
function sessionBecomes(status: typeof mockSession.status, scope: string | null = mockSession.scope) {
	mockSession.status = status;
	mockSession.scope = scope;
	const { listeners } = jest.requireMock<{ listeners: Set<() => void> }>("@/auth/session");
	for (const listener of listeners) listener();
}

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
	mockSession.status = "signed-in";
	mockSession.scope = ACCOUNT_A;
	closeProfile();
	clearPendingProfile(Storage, ACCOUNT_A);
	clearPendingProfile(Storage, ACCOUNT_B);
	openProfile({ data: profileWith("Dana"), updatedAt: version }, SERVER, new QueryClient());
});

// A test that ends with an edit still waiting leaves the debounced save's timer behind; close the editor to clear it.
afterEach(() => closeProfile());

describe("the Profile editor store", () => {
	it("opens the Profile as resume data for the entry forms", () => {
		const { data, server, scope } = useProfileEditor.getState();
		expect(server).toBe(SERVER);
		expect(scope).toBe(ACCOUNT_A);
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

		const [input, options] = mockApi.update.mock.calls[0] as [
			{ data: ProfileData; expectedUpdatedAt: Date | null },
			{ context: { scope: string } },
		];
		expect(input.expectedUpdatedAt).toBe(version);
		expect(input.data.basics.name).toBe("Dana Putri");
		// Bound to the account: the API client refuses to send it with another account's session.
		expect(options.context.scope).toBe(ACCOUNT_A);
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

describe("the Profile editor and accounts", () => {
	it("closes when another account signs in on the same server, and never sends the first account's edits", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		rename("Dana offline");
		await saveProfileNow();
		expect(useProfileEditor.getState().status).toBe("error");

		sessionBecomes("signed-in", ACCOUNT_B);
		const closed = useProfileEditor.getState();
		expect(closed.data).toBeNull();
		expect(closed.followed).toEqual([]);
		expect(hasUnsavedProfileChanges()).toBe(false);

		mockApi.update.mockResolvedValue({ data: profileWith("Bima"), updatedAt: later, updatedResumes: [] });
		openProfile({ data: profileWith("Bima"), updatedAt: version }, SERVER, new QueryClient());
		expect(useProfileEditor.getState().data?.basics.name).toBe("Bima");
		rename("Bima Sakti");
		await saveProfileNow();
		const sent = mockApi.update.mock.calls.map(([input]) => (input as { data: ProfileData }).data.basics.name);
		expect(sent).toEqual(["Dana offline", "Bima Sakti"]);
		// The first account's edits stay on this device for when it's back, not in the second one's Profile.
		expect(loadPendingProfile(Storage, ACCOUNT_A)?.data.basics.name).toBe("Dana offline");
		expect(loadPendingProfile(Storage, ACCOUNT_B)).toBeNull();
	});

	it("closes on sign-out and keeps nothing on this device", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		rename("Dana offline");
		await saveProfileNow();
		// Sign-out removes the account's kept data before the session reports signed out (src/auth/session.ts).
		clearPendingProfile(Storage, ACCOUNT_A);
		sessionBecomes("signed-out", null);
		expect(useProfileEditor.getState().data).toBeNull();
		expect(loadPendingProfile(Storage, ACCOUNT_A)).toBeNull();
	});

	it("sends nothing while the session has expired, keeps the edits on screen, and sends them after signing back in", async () => {
		sessionBecomes("expired");
		rename("Dana while expired");
		await expect(saveProfileNow()).resolves.toBe(false);
		expect(mockApi.update).not.toHaveBeenCalled();
		const state = useProfileEditor.getState();
		expect(state.data?.basics.name).toBe("Dana while expired");
		expect(state.status).toBe("error");

		mockApi.update.mockResolvedValue({ data: profileWith("Dana while expired"), updatedAt: later, updatedResumes: [] });
		sessionBecomes("signed-in", ACCOUNT_A);
		await waitForSave();
		expect(mockApi.update).toHaveBeenCalledTimes(1);
		expect(useProfileEditor.getState().status).toBe("saved");
	});

	it("does not take a save that came back after the account changed", async () => {
		let answer: (value: unknown) => void = () => undefined;
		mockApi.update.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
		rename("Dana slow");
		const saving = saveProfileNow();
		sessionBecomes("signed-in", ACCOUNT_B);
		answer({ data: profileWith("Dana slow"), updatedAt: later, updatedResumes: [{ id: "r1", name: "CV" }] });
		await saving;
		const state = useProfileEditor.getState();
		expect(state.data).toBeNull();
		expect(state.followed).toEqual([]);
		expect(state.status).toBe("idle");
	});
});

describe("Profile edits kept on this device", () => {
	it("keeps edits a failed save couldn't send, and sends them when the Profile opens again after a restart", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		rename("Dana offline");
		await saveProfileNow();
		expect(loadPendingProfile(Storage, ACCOUNT_A)).toEqual({
			data: expect.objectContaining({ basics: expect.objectContaining({ name: "Dana offline" }) }),
			updatedAt: version,
		});

		// The app is closed and opened again: the editor starts empty and reads the server's copy.
		closeProfile();
		mockApi.update.mockResolvedValueOnce({ data: profileWith("Dana offline"), updatedAt: later, updatedResumes: [] });
		openProfile({ data: profileWith("Dana"), updatedAt: version }, SERVER, new QueryClient());
		expect(useProfileEditor.getState().data?.basics.name).toBe("Dana offline");
		await waitForSave();
		const [input] = mockApi.update.mock.calls[1] as [{ data: ProfileData; expectedUpdatedAt: Date | null }];
		expect(input.data.basics.name).toBe("Dana offline");
		expect(input.expectedUpdatedAt).toEqual(version);
		expect(loadPendingProfile(Storage, ACCOUNT_A)).toBeNull();
	});

	it("drops the kept edits without sending when the server already has them", async () => {
		mockApi.update.mockRejectedValueOnce(new TypeError("Network request failed"));
		rename("Dana landed");
		await saveProfileNow();
		expect(loadPendingProfile(Storage, ACCOUNT_A)?.data.basics.name).toBe("Dana landed");

		// The write reached the server although its answer was lost.
		closeProfile();
		openProfile({ data: profileWith("Dana landed"), updatedAt: later }, SERVER, new QueryClient());
		await waitForSave();
		expect(mockApi.update).toHaveBeenCalledTimes(1);
		expect(useProfileEditor.getState().conflict).toBeFalsy();
		expect(loadPendingProfile(Storage, ACCOUNT_A)).toBeNull();
	});

	it("forgets the kept edits when the person picks the saved version", async () => {
		mockApi.update.mockRejectedValueOnce(new ORPCError("PROFILE_VERSION_CONFLICT", { status: 409 }));
		mockApi.get.mockResolvedValue({ data: profileWith("Dana from the web"), updatedAt: later });
		rename("Dana on the phone");
		await saveProfileNow();
		expect(loadPendingProfile(Storage, ACCOUNT_A)?.data.basics.name).toBe("Dana on the phone");
		await resolveProfileConflict("use-theirs");
		expect(loadPendingProfile(Storage, ACCOUNT_A)).toBeNull();
	});
});

/** Lets a save started by a listener finish. */
async function waitForSave() {
	for (let tick = 0; tick < 5; tick++) await Promise.resolve();
}
