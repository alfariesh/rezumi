// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorksTable } from "./portfolio-statistics";
import { WorkStatisticsDialog } from "./work-statistics";
import { orpc } from "@/libs/orpc/client";

const mocks = vi.hoisted(() => ({ openPlanDialog: vi.fn() }));
vi.mock("@/features/billing/plan-dialog", () => ({ openPlanDialog: mocks.openPlanDialog }));

i18n.loadAndActivate({ locale: "en", messages: {} });

const wrap = (node: React.ReactNode, client = new QueryClient()) => (
	<QueryClientProvider client={client}>
		<I18nProvider i18n={i18n}>{node}</I18nProvider>
	</QueryClientProvider>
);

describe("statistics per work", () => {
	it("lists every work opened with its share, and opens a work's own numbers", async () => {
		const onDetails = vi.fn();
		render(
			wrap(
				<WorksTable
					works={[
						{ id: "w1", title: "Kopi Senja", opens: 3 },
						{ id: "w2", title: "Batik", opens: 1 },
					]}
					onDetails={onDetails}
				/>,
			),
		);
		const rows = screen.getAllByRole("row").slice(1);
		expect(rows).toHaveLength(2);
		expect(within(rows[0] as HTMLElement).getByText("75%")).toBeTruthy();
		expect(within(rows[1] as HTMLElement).getByText("25%")).toBeTruthy();
		await userEvent.setup().click(screen.getByRole("button", { name: "Details for Batik" }));
		expect(onDetails).toHaveBeenCalledWith({ id: "w2", title: "Batik" });
	});

	it("says so when no work was opened", () => {
		render(wrap(<WorksTable works={[]} onDetails={() => {}} />));
		expect(screen.getByText("No work opened yet.")).toBeTruthy();
	});

	it("shows a work's daily numbers on every plan, and the breakdown locked on Free", async () => {
		const client = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } });
		client.setQueryData(orpc.portfolio.workStatistics.queryKey({ input: { workId: "w1", range: 7 } }), {
			range: { days: 7, from: "2026-11-06", to: "2026-11-12" },
			work: { id: "w1", title: "Kopi Senja", slug: "kopi-senja" },
			days: [
				{ date: "2026-11-11", opens: 2 },
				{ date: "2026-11-12", opens: 1 },
			],
			totals: { opens: 3 },
			details: { state: "locked" },
		});
		render(wrap(<WorkStatisticsDialog workId="w1" title="Kopi Senja" range={7} onClose={() => {}} />, client));
		expect(await screen.findByRole("dialog", { name: "Kopi Senja" })).toBeTruthy();
		expect(screen.getByText("Times opened")).toBeTruthy();
		await userEvent.setup().click(screen.getByRole("button", { name: /See what's included/ }));
		expect(mocks.openPlanDialog).toHaveBeenCalledWith({ kind: "feature", feature: "detailedPortfolioStats" });
	});
});
