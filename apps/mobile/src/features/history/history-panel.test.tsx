// History (plans/mobile Phase 07 step 7): the versions list, opening a version read-only, restoring it with Undo,
// naming the current state, and the loading and error states. Requests are replaced; the screen is the real one.
import type { Version } from "./format";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ORPCError } from "@orpc/client";
import { HistoryPanel } from "./history-panel";
import { renderScreen } from "@/test/render-screen";

const today = new Date();
const versions: Version[] = [
	{ id: "v2", kind: "named", name: "Sent to Lumen", createdAt: today },
	{ id: "v1", kind: "auto", name: null, createdAt: new Date(2025, 2, 4) },
] as Version[];

const mock = {
	params: {} as { version?: string },
	list: {
		data: versions as Version[] | undefined,
		isPending: false,
		isError: false,
		isSuccess: true,
		refetch: jest.fn(),
	},
	save: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
	restore: jest.fn<Promise<string | null>, [string]>(() => Promise.resolve("b1")),
	rename: jest.fn(() => Promise.resolve()),
	remove: jest.fn(() => Promise.resolve()),
	toast: jest.fn<string, [{ title: string; variant?: string; undo?: { onUndo: () => void } }]>(() => "toast"),
	online: true,
};

jest.mock("expo-router", () => ({ useLocalSearchParams: () => mock.params }));
// The real document operations run every action: the session and network checks and the error wording.
jest.mock("expo-network", () => ({
	getNetworkStateAsync: () => Promise.resolve({ isConnected: mock.online, isInternetReachable: mock.online }),
}));
jest.mock("@/auth/session", () => ({
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
	getServer: () => "https://rezumi.app",
}));
jest.mock("@/api/client", () => ({
	client: {},
	orpc: {
		documents: { key: () => ["documents"] },
		resume: { key: () => ["resume"] },
		coverLetters: { key: () => ["coverLetters"] },
		applications: { key: () => ["applications"] },
	},
}));
jest.mock("./use-history", () => ({
	useHistory: () => ({
		list: mock.list,
		save: (name: string) => mock.save(name),
		restore: (id: string) => mock.restore(id),
		rename: (...args: unknown[]) => mock.rename(...(args as [])),
		remove: (...args: unknown[]) => mock.remove(...(args as [])),
	}),
}));
jest.mock("./version-page", () => {
	const { View } = require("react-native");
	return { VersionPage: ({ versionId }: { versionId: string }) => <View testID={`version-page-${versionId}`} /> };
});
jest.mock("@/ui", () => ({
	...jest.requireActual<object>("@/ui"),
	showToast: (options: { title: string }) => mock.toast(options),
}));

const resume = { id: "r1", isLocked: false };

beforeEach(() => {
	jest.clearAllMocks();
	mock.online = true;
	mock.params = {};
	mock.list = { ...mock.list, data: versions, isPending: false, isError: false, isSuccess: true };
});

describe("History", () => {
	it("lists Now and every version, named ones with their options", async () => {
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		expect(screen.getByText("Now")).toBeTruthy();
		expect(screen.getByText("Sent to Lumen")).toBeTruthy();
		expect(screen.getByText("Editing session")).toBeTruthy();
		expect(screen.getByLabelText("Options for Sent to Lumen")).toBeTruthy();
		expect(screen.queryByLabelText("Options for Editing session")).toBeNull();
	});

	it("opens a version read-only, and goes back to now", async () => {
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Editing session"));
		});
		expect(screen.getByTestId("history-viewing")).toBeTruthy();
		expect(screen.getByTestId("version-page-v1")).toBeTruthy();
		await act(async () => {
			await fireEvent.press(screen.getByText("Back to now"));
		});
		expect(screen.queryByTestId("history-viewing")).toBeNull();
	});

	it("opens the version Applications links to", async () => {
		mock.params = { version: "v2" };
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		expect(screen.getByTestId("version-page-v2")).toBeTruthy();
	});

	it("restores at once, with an Undo that restores the state before it", async () => {
		mock.params = { version: "v1" };
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-restore"));
		});
		expect(mock.restore).toHaveBeenCalledWith("v1");
		const [toast] = mock.toast.mock.calls.at(-1) ?? [];
		expect(toast?.title).toMatch(/^Restored the version from .*“Before restore”\.$/);
		// Undo restores the exact "Before restore" version the server reported, not one picked by the device clock.
		await act(async () => toast?.undo?.onUndo());
		await waitFor(() => expect(mock.restore).toHaveBeenLastCalledWith("b1"));
		await waitFor(() => expect(mock.toast.mock.calls.at(-1)?.[0].title).toBe("Restore undone"));
	});

	it("offers no Undo when the state before the restore can't be read back", async () => {
		mock.params = { version: "v1" };
		mock.restore.mockResolvedValueOnce(null);
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-restore"));
		});
		await waitFor(() => expect(mock.toast).toHaveBeenCalled());
		expect(mock.toast.mock.calls.at(-1)?.[0].undo).toBeUndefined();
	});

	it("words a failed restore for people, not with the server's message", async () => {
		mock.params = { version: "v1" };
		mock.restore.mockRejectedValueOnce(new ORPCError("RESUME_LOCKED", { message: "resume_locked: row 42" }));
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-restore"));
		});
		await waitFor(() =>
			expect(mock.toast).toHaveBeenCalledWith({
				title: "This resume is locked. Unlock it to make changes.",
				variant: "danger",
			}),
		);
	});

	it("checks the connection before saving a version", async () => {
		mock.online = false;
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.changeText(screen.getByLabelText("Name this version"), "Sent to Orbit");
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-save"));
		});
		await waitFor(() =>
			expect(mock.toast).toHaveBeenCalledWith({
				title: "You're offline. Try again when you reconnect.",
				variant: "danger",
			}),
		);
		expect(mock.save).not.toHaveBeenCalled();
	});

	it("doesn't restore over a locked resume", async () => {
		mock.params = { version: "v1" };
		await renderScreen(<HistoryPanel resume={{ id: "r1", isLocked: true }} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-restore"));
		});
		expect(mock.restore).not.toHaveBeenCalled();
	});

	it("names the current state", async () => {
		await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.changeText(screen.getByLabelText("Name this version"), "Sent to Orbit");
		});
		await act(async () => {
			await fireEvent.press(screen.getByTestId("history-save"));
		});
		expect(mock.save).toHaveBeenCalledWith("Sent to Orbit");
		expect(mock.toast.mock.calls.at(-1)?.[0].title).toBe("Saved “Sent to Orbit”");
	});

	it("shows the loading shape, then a failed load with Retry", async () => {
		mock.list = { ...mock.list, data: undefined, isPending: true, isSuccess: false };
		const view = await renderScreen(<HistoryPanel resume={resume} offline={false} />);
		expect(screen.getByTestId("history-loading")).toBeTruthy();
		mock.list = { ...mock.list, isPending: false, isError: true };
		await view.rerender(<HistoryPanel resume={resume} offline={false} />);
		await act(async () => {
			await fireEvent.press(screen.getByText("Retry"));
		});
		expect(mock.list.refetch).toHaveBeenCalled();
	});
});
