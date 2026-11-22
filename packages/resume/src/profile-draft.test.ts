import type { ProfileDraftSnapshot, ProfileDraftStatus, ProfileSaveResult } from "./profile-draft";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { createProfileSaver, mergeFollowed } from "./profile-draft";

class ConflictError extends Error {}

const profileWith = (name: string): ProfileData => {
	const data = emptyProfileData();
	data.basics.name = name;
	return data;
};

const version = new Date("2026-11-21T08:00:00.000Z");
const later = new Date("2026-11-21T09:00:00.000Z");

function setup() {
	let snapshot: ProfileDraftSnapshot | null = { data: profileWith("Dana"), updatedAt: version };
	const statuses: ProfileDraftStatus[] = [];
	const send = vi.fn<(input: { data: ProfileData; expectedUpdatedAt: Date | null }) => Promise<ProfileSaveResult>>();
	const onSaved = vi.fn((result: ProfileSaveResult) => {
		if (snapshot) snapshot = { ...snapshot, updatedAt: result.updatedAt };
	});
	const onConflict = vi.fn(() => {
		snapshot = { data: profileWith("Dana from the web"), updatedAt: later };
	});
	const saver = createProfileSaver({
		read: () => snapshot,
		send,
		isConflict: (error) => error instanceof ConflictError,
		onStatus: (status) => statuses.push(status),
		onSaved,
		onConflict,
	});
	const edit = (name: string) => {
		if (snapshot) snapshot = { ...snapshot, data: profileWith(name) };
		saver.queue();
	};
	return { saver, send, onSaved, onConflict, statuses, edit, read: () => snapshot };
}

const saved = (name: string, updatedAt = later): ProfileSaveResult => ({
	data: profileWith(name),
	updatedAt,
	updatedResumes: [{ id: "r1", name: "Product CV" }],
});

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("createProfileSaver", () => {
	it("saves once typing pauses, with the version the edits were made on", async () => {
		const { saver, send, onSaved, statuses, edit } = setup();
		send.mockResolvedValue(saved("Dana Putri"));

		edit("Dana P");
		edit("Dana Putri");
		expect(saver.hasUnsavedChanges()).toBe(true);
		await vi.advanceTimersByTimeAsync(799);
		expect(send).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(send).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith({ data: profileWith("Dana Putri"), expectedUpdatedAt: version });
		expect(onSaved).toHaveBeenCalledWith(saved("Dana Putri"));
		expect(statuses).toEqual(["saving", "saved"]);
		expect(saver.hasUnsavedChanges()).toBe(false);
	});

	it("does nothing when there is nothing to send", async () => {
		const { saver, send } = setup();
		await expect(saver.saveNow()).resolves.toBe(true);
		expect(send).not.toHaveBeenCalled();
	});

	it("sends edits typed during a save next, with the version that save returned", async () => {
		const { saver, send, edit } = setup();
		let finish: (result: ProfileSaveResult) => void = () => undefined;
		send.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
		send.mockResolvedValueOnce(saved("Dana Putri Ayu", new Date("2026-11-21T10:00:00.000Z")));

		edit("Dana Putri");
		const first = saver.saveNow();
		edit("Dana Putri Ayu");
		finish(saved("Dana Putri"));

		await expect(first).resolves.toBe(true);
		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls[1]?.[0]).toEqual({ data: profileWith("Dana Putri Ayu"), expectedUpdatedAt: later });
		expect(saver.hasUnsavedChanges()).toBe(false);
	});

	it("hands over to the editor on a version conflict and drops the edits", async () => {
		const { saver, send, onConflict, statuses, edit, read } = setup();
		send.mockRejectedValue(new ConflictError());

		edit("Dana here");
		await expect(saver.saveNow()).resolves.toBe(false);

		expect(onConflict).toHaveBeenCalledOnce();
		expect(read()?.data.basics.name).toBe("Dana from the web");
		expect(statuses).toEqual(["saving"]);
		expect(saver.hasUnsavedChanges()).toBe(false);
	});

	it("answers false to a second saveNow while a save that hits a conflict is on its way", async () => {
		const { saver, send, onConflict, edit } = setup();
		let reject: (error: unknown) => void = () => undefined;
		send.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));

		edit("Dana here");
		const first = saver.saveNow();
		// Leaving the screen, or an action that needs the saved Profile, asks while the first save is out.
		const second = saver.saveNow();
		reject(new ConflictError());

		await expect(first).resolves.toBe(false);
		await expect(second).resolves.toBe(false);
		expect(onConflict).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledOnce();
	});

	it("answers false to a second saveNow while a save that fails is on its way, sending nothing more", async () => {
		const { saver, send, edit } = setup();
		let reject: (error: unknown) => void = () => undefined;
		send.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)));

		edit("Dana offline");
		const first = saver.saveNow();
		const second = saver.saveNow();
		reject(new TypeError("Network request failed"));

		await expect(first).resolves.toBe(false);
		await expect(second).resolves.toBe(false);
		expect(send).toHaveBeenCalledOnce();
		expect(saver.hasUnsavedChanges()).toBe(true);
	});

	it("keeps the edits when offline and sends them on retry", async () => {
		const { saver, send, statuses, edit } = setup();
		send.mockRejectedValueOnce(new TypeError("Network request failed"));
		send.mockResolvedValueOnce(saved("Dana Putri"));

		edit("Dana Putri");
		await expect(saver.saveNow()).resolves.toBe(false);
		expect(statuses.at(-1)).toBe("error");
		expect(saver.hasUnsavedChanges()).toBe(true);

		await expect(saver.retry()).resolves.toBe(true);
		expect(send).toHaveBeenCalledTimes(2);
		expect(statuses.at(-1)).toBe("saved");
		expect(saver.hasUnsavedChanges()).toBe(false);
	});

	it("forgets pending edits when a fresh Profile is loaded", async () => {
		const { saver, send, edit } = setup();
		edit("Dana Putri");
		saver.reset();
		await vi.advanceTimersByTimeAsync(1000);
		expect(send).not.toHaveBeenCalled();
		expect(saver.hasUnsavedChanges()).toBe(false);
	});
});

describe("mergeFollowed", () => {
	it("keeps each resume once", () => {
		expect(
			mergeFollowed(
				[{ id: "r1", name: "A" }],
				[
					{ id: "r1", name: "A" },
					{ id: "r2", name: "B" },
				],
			),
		).toEqual([
			{ id: "r1", name: "A" },
			{ id: "r2", name: "B" },
		]);
	});
});
