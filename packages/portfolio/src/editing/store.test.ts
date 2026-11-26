import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { createPortfolioEditor, PORTFOLIO_SAVE_DELAY_MS } from "./store";

const edition = (name: string, timestamp: number) => ({
	data: parsePortfolioData({ basics: { name } }),
	updatedAt: new Date(timestamp),
});
const original = edition("Ada", 1);
const changeName = (name: string) => (draft: PortfolioData) => {
	draft.basics.name = name;
};

describe("shared portfolio editor", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("saves one coalesced edit and keeps undo and redo across saves", async () => {
		const update = vi.fn(async () => ({ updatedAt: new Date(2) }));
		const { store } = createPortfolioEditor({ read: async () => ({ enabled: true, portfolio: original }), update });
		store.getState().load(original);
		store.getState().edit(changeName("Ada Lov"), { key: "name" });
		store.getState().edit(changeName("Ada Lovelace"), { key: "name" });
		expect(update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(PORTFOLIO_SAVE_DELAY_MS);
		expect(update).toHaveBeenCalledExactlyOnceWith(
			{ data: edition("Ada Lovelace", 2).data, expectedUpdatedAt: original.updatedAt },
			expect.any(AbortSignal),
		);
		expect(store.getState().status).toBe("saved");
		store.getState().undo();
		expect(store.getState().portfolio?.data.basics.name).toBe("Ada");
		store.getState().redo();
		expect(store.getState().portfolio?.data.basics.name).toBe("Ada Lovelace");
		store.getState().reset();
	});

	it("keeps local edits when another editor saved first and uses the chosen version", async () => {
		const remote = edition("Grace", 2);
		const update = vi
			.fn()
			.mockRejectedValueOnce(new ORPCError("PORTFOLIO_VERSION_CONFLICT", { data: { updatedAt: remote.updatedAt } }))
			.mockResolvedValueOnce({ updatedAt: new Date(3) });
		const { store } = createPortfolioEditor({ read: async () => ({ enabled: true, portfolio: remote }), update });
		store.getState().load(original);
		store.getState().edit(changeName("Ada Lovelace"));

		expect(await store.getState().flush()).toBe(false);
		expect(store.getState().conflict?.server).toEqual(remote);
		expect(store.getState().portfolio?.data.basics.name).toBe("Ada Lovelace");
		expect(await store.getState().keepMine()).toBe(true);
		expect(update.mock.calls[1]?.[0]).toMatchObject({ expectedUpdatedAt: remote.updatedAt });
		store.getState().reset();
	});

	it("keeps edits typed while importing a project and offers the imported version to resolve", () => {
		const imported = edition("Ada with a new project", 2);
		const { store } = createPortfolioEditor({
			read: async () => ({ enabled: true, portfolio: imported }),
			update: async () => ({ updatedAt: new Date(3) }),
		});
		store.getState().load(original);
		store.getState().edit(changeName("Ada Lovelace"));
		store.getState().applyServerEdit(imported, original.data);
		expect(store.getState().conflict?.server).toEqual(imported);
		expect(store.getState().portfolio?.data.basics.name).toBe("Ada Lovelace");
		store.getState().reset();
	});
});
