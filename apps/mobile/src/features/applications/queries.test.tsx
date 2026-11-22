// Stage actions (Phase 10): a move or close runs at once with an Undo toast that puts the old stage back, a bulk move
// undoes per old stage, and deleting reports what went. The API is a fixture; the hooks are the real ones.
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useApplicationActions } from "./queries";

const mockApi = {
	update: jest.fn((_input: unknown) => Promise.resolve({})),
	bulkUpdate: jest.fn((_input: unknown) => Promise.resolve({ updated: 1 })),
	remove: jest.fn((_input: unknown) => Promise.resolve({})),
	bulkDelete: jest.fn((_input: unknown) => Promise.resolve({ deleted: 2 })),
};
type MockToast = { title: string; undo?: { onUndo: () => void } };
const mockToast = jest.fn((_options: MockToast) => undefined);

jest.mock("@/api/client", () => {
	const mutation = (fn: (input: unknown) => Promise<unknown>) => ({ mutationOptions: () => ({ mutationFn: fn }) });
	return {
		orpc: {
			applications: {
				key: () => ["applications"],
				listSummary: { queryOptions: () => ({ queryKey: ["applications", "summary"] }) },
				getById: { queryOptions: () => ({ queryKey: ["applications", "detail"] }) },
				create: mutation(() => Promise.resolve("new")),
				update: mutation((input) => mockApi.update(input)),
				bulkUpdate: mutation((input) => mockApi.bulkUpdate(input)),
				delete: mutation((input) => mockApi.remove(input)),
				bulkDelete: mutation((input) => mockApi.bulkDelete(input)),
				import: mutation(() => Promise.resolve({})),
			},
			documents: { list: { key: () => ["documents"] } },
		},
		rest: jest.fn(),
	};
});
jest.mock("@/auth/session", () => ({
	getServer: () => "https://rezumi.app",
	useSession: () => ({ status: "signed-in", server: "https://rezumi.app" }),
}));
jest.mock("@/features/reminders", () => ({ syncReminders: () => Promise.resolve() }));
jest.mock("@/ui", () => ({ showToast: (options: MockToast) => mockToast(options) }));

i18n.loadAndActivate({ locale: "en", messages: {} });

function wrapper({ children }: { children: ReactNode }) {
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
			mutations: { gcTime: Number.POSITIVE_INFINITY },
		},
	});
	return (
		<QueryClientProvider client={client}>
			<I18nProvider i18n={i18n}>{children}</I18nProvider>
		</QueryClientProvider>
	);
}

const lastToast = () => mockToast.mock.calls.at(-1)?.[0];

beforeEach(() => jest.clearAllMocks());

describe("useApplicationActions", () => {
	it("moves at once, and Undo puts the old stage back", async () => {
		const { result } = await renderHook(() => useApplicationActions(), { wrapper });
		await act(() => result.current.moveTo({ id: "a1", status: "applied", closedReason: null }, "screening"));
		await waitFor(() => expect(mockApi.update).toHaveBeenCalledWith({ id: "a1", status: "screening" }));
		expect(lastToast()?.title).toBe("Moved to Screening");
		await act(() => lastToast()?.undo?.onUndo());
		await waitFor(() => expect(mockApi.update).toHaveBeenLastCalledWith({ id: "a1", status: "applied" }));
	});

	it("closes with a reason, and Undo reopens at the old stage", async () => {
		const { result } = await renderHook(() => useApplicationActions(), { wrapper });
		await act(() =>
			result.current.moveTo({ id: "a1", status: "interview", closedReason: null }, "closed", "not-selected"),
		);
		await waitFor(() =>
			expect(mockApi.update).toHaveBeenCalledWith({ id: "a1", status: "closed", closedReason: "not-selected" }),
		);
		expect(lastToast()?.title).toBe("Application closed");
		await act(() => lastToast()?.undo?.onUndo());
		await waitFor(() => expect(mockApi.update).toHaveBeenLastCalledWith({ id: "a1", status: "interview" }));
	});

	it("moves several at once and undoes each back to its own stage", async () => {
		const { result } = await renderHook(() => useApplicationActions(), { wrapper });
		await act(() =>
			result.current.moveMany(
				[
					{ id: "a1", status: "applied", closedReason: null },
					{ id: "a2", status: "applied", closedReason: null },
					{ id: "a3", status: "saved", closedReason: null },
				],
				"interview",
			),
		);
		await waitFor(() =>
			expect(mockApi.bulkUpdate).toHaveBeenCalledWith({ ids: ["a1", "a2", "a3"], status: "interview" }),
		);
		expect(lastToast()?.title).toBe("3 applications moved to Interview");
		await act(() => lastToast()?.undo?.onUndo());
		await waitFor(() => expect(mockApi.bulkUpdate).toHaveBeenLastCalledWith({ ids: ["a1", "a2"], status: "applied" }));
		expect(mockApi.update).toHaveBeenLastCalledWith({ id: "a3", status: "saved" });
	});

	it("deletes for good and says how many went", async () => {
		const done = jest.fn();
		const { result } = await renderHook(() => useApplicationActions(), { wrapper });
		await act(() => result.current.removeMany(["a1", "a2"], done));
		await waitFor(() => expect(done).toHaveBeenCalled());
		expect(mockApi.bulkDelete).toHaveBeenCalledWith({ ids: ["a1", "a2"] });
		expect(lastToast()?.title).toBe("2 applications deleted");
		expect(lastToast()?.undo).toBeUndefined();
	});
});
