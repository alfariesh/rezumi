// The applications list and detail caches: keys scoped per server, a detail seeded from the list's initial details only
// while its stage still matches, and a newer cached detail never overwritten by an older list row.
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	applicationDetailQueryOptions,
	applicationsListQueryKey,
	applicationsListQueryOptions,
	useApplication,
	useApplications,
} from "./queries";

const mockList = jest.fn((): unknown[] => []);

jest.mock("@/api/client", () => ({
	orpc: {
		applications: {
			key: () => ["applications"],
			listSummary: {
				queryOptions: ({ input }: { input: unknown }) => ({
					queryKey: ["applications", "summary", input],
					queryFn: () => Promise.resolve(mockList()),
				}),
			},
			getById: {
				queryOptions: ({ input }: { input: unknown }) => ({
					queryKey: ["applications", "detail", input],
					queryFn: () => new Promise(() => {}),
				}),
			},
		},
		documents: { list: { key: () => ["documents"] } },
	},
	rest: jest.fn(),
}));
jest.mock("@/auth/session", () => ({
	getServer: () => "server-a",
	useSession: () => ({ status: "signed-in", server: "server-a" }),
}));
jest.mock("@/features/reminders", () => ({ syncReminders: () => Promise.resolve() }));

const older = new Date("2026-01-01T00:00:00Z");
const newer = new Date("2026-01-03T00:00:00Z");
const detail = (patch: object) => ({ id: "app-a", status: "applied", closedReason: null, notes: "", ...patch });
const row = (initialDetail: object) => ({ id: "app-a", status: "applied", closedReason: null, initialDetail });

function setup() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, wrapper };
}

describe("applications caches", () => {
	it("scopes list and detail keys by server", () => {
		expect(applicationsListQueryOptions("server-a").queryKey).toEqual([
			"applications",
			"summary",
			{ includeInitialDetails: 3 },
			"server-a",
		]);
		expect(applicationsListQueryKey("server-b").at(-1)).toBe("server-b");
		expect(applicationDetailQueryOptions("app-a", "server-a").queryKey).toEqual([
			"applications",
			"detail",
			{ id: "app-a" },
			"server-a",
		]);
	});

	it("seeds a detail from the list only while the stage matches", async () => {
		const { client, wrapper } = setup();
		client.setQueryData(applicationsListQueryKey("server-a"), [row(detail({ notes: "from list" }))]);
		const { result } = await renderHook(() => useApplication("app-a"), { wrapper });
		expect((result.current.data as { notes: string } | undefined)?.notes).toBe("from list");

		const stale = setup();
		stale.client.setQueryData(applicationsListQueryKey("server-a"), [row(detail({ status: "closed" }))]);
		const second = await renderHook(() => useApplication("app-a"), { wrapper: stale.wrapper });
		expect(second.result.current.data).toBeUndefined();
	});

	it("never replaces a newer cached detail with an older list row", async () => {
		const { client, wrapper } = setup();
		const detailKey = applicationDetailQueryOptions("app-a", "server-a").queryKey;
		client.setQueryData(detailKey, detail({ notes: "newer", updatedAt: newer }));
		mockList.mockReturnValue([row(detail({ notes: "old", updatedAt: older }))]);
		const { result } = await renderHook(() => useApplications(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect((client.getQueryData(detailKey) as { notes: string }).notes).toBe("newer");

		client.setQueryData(detailKey, detail({ notes: "old", updatedAt: older }));
		mockList.mockReturnValue([row(detail({ notes: "fresh", updatedAt: newer }))]);
		await result.current.refetch();
		await waitFor(() => expect((client.getQueryData(detailKey) as { notes: string }).notes).toBe("fresh"));
	});
});
