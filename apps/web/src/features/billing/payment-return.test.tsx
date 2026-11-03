// @vitest-environment happy-dom

import type { PaymentDetail } from "./purchase";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({ payment: vi.fn() }));

vi.mock("@/libs/orpc/client", () => ({
	orpc: {
		billing: {
			key: () => ["billing"],
			payment: {
				queryOptions: ({ input }: { input: { id: string } }) => ({
					queryKey: ["billing", "payment", input.id],
					queryFn: async () => api.payment(input.id),
				}),
			},
		},
	},
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: { paymentId: string } }) => (
		<a href={params ? to.replace("$paymentId", params.paymentId) : to}>{children}</a>
	),
	useRouteContext: () => ({ session: { user: { timezone: "UTC" } } }),
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

const { PaymentReturnPage } = await import("./payment-return");

const ID = "01a19ef4-a65a-7256-91f4-54f7c9b40fbf";
const paidAt = new Date("2026-11-03T01:10:00Z");

const payment = (patch: Partial<PaymentDetail>): PaymentDetail => ({
	id: ID,
	orderId: `RZ-${ID}`,
	planId: "pro-ai",
	amount: 79_000,
	currency: "IDR",
	durationDays: 30,
	credits: 100,
	status: "pending",
	paymentType: "bank_transfer",
	createdAt: new Date(+paidAt - 60_000),
	expiresAt: new Date(Date.now() + 86_400_000),
	paidAt: null,
	refundedAmount: 0,
	redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/token",
	access: null,
	...patch,
});

function renderPage(paymentId: string | null = ID) {
	return render(
		<I18nProvider i18n={i18n}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<PaymentReturnPage paymentId={paymentId} />
			</QueryClientProvider>
		</I18nProvider>,
	);
}

describe("returning from Midtrans", () => {
	// A fresh mock per test: mockReset() leaves a rejecting implementation reported as an unhandled error.
	beforeEach(() => {
		api.payment = vi.fn();
	});

	it("shows the pass, its end and the credits once the server says it's paid", async () => {
		api.payment.mockResolvedValue(
			payment({
				status: "paid",
				paidAt,
				redirectUrl: null,
				access: { startsAt: paidAt, endsAt: new Date(+paidAt + 30 * 86_400_000) },
			}),
		);
		renderPage();
		expect(await screen.findByText("Payment received")).toBeTruthy();
		expect(screen.getByText(/Pro AI is active until December 3, 2026/)).toBeTruthy();
		expect(screen.getByText("100 credits added for Rezumi AI.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "View receipt" }).getAttribute("href")).toBe(
			`/dashboard/settings/billing/receipt/${ID}`,
		);
	});

	it("says when a queued pass starts", async () => {
		const startsAt = new Date(+paidAt + 10 * 86_400_000);
		api.payment.mockResolvedValue(
			payment({
				planId: "plus",
				credits: 0,
				status: "paid",
				paidAt,
				access: { startsAt, endsAt: new Date(+startsAt + 30 * 86_400_000) },
			}),
		);
		renderPage();
		expect(await screen.findByText(/Plus starts on November 13, 2026/)).toBeTruthy();
		expect(screen.queryByText(/added for Rezumi AI/)).toBeNull();
	});

	it("waits for an open payment, with the way back to Midtrans, and turns paid by itself", async () => {
		api.payment.mockResolvedValueOnce(payment({}));
		api.payment.mockResolvedValue(payment({ status: "paid", paidAt, access: { startsAt: paidAt, endsAt: paidAt } }));
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
			renderPage();
			expect(await screen.findByText("Waiting for your payment")).toBeTruthy();
			expect(screen.getByRole("link", { name: "Continue payment" }).getAttribute("href")).toContain(
				"app.sandbox.midtrans.com",
			);
			expect(screen.getByText(/can still be paid any time until/)).toBeTruthy();
			await vi.advanceTimersByTimeAsync(3500);
			await waitFor(() => expect(screen.getByText("Payment received")).toBeTruthy());
		} finally {
			vi.useRealTimers();
		}
	});

	it("offers a new payment when the time to pay is over", async () => {
		api.payment.mockResolvedValue(payment({ expiresAt: new Date(Date.now() - 1000), redirectUrl: null }));
		renderPage();
		expect(await screen.findByText("The time to pay has run out")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Try again" })).toBeTruthy();
	});

	it.each([
		["failed", "This payment didn't go through"],
		["cancelled", "This payment didn't go through"],
		["expired", "This payment expired"],
		["refunded", "This payment was refunded"],
	] as const)("explains a %s payment", async (status, title) => {
		api.payment.mockResolvedValue(payment({ status, redirectUrl: null }));
		renderPage();
		expect(await screen.findByText(title)).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Continue payment" })).toBeNull();
	});

	it("doesn't show another account's payment, or one it can't tell from the link", async () => {
		api.payment.mockImplementation(async () => {
			throw new ORPCError("NOT_FOUND", { message: "No payment of yours has that ID." });
		});
		const { unmount } = renderPage();
		expect(await screen.findByText("We couldn't find this payment")).toBeTruthy();
		expect(screen.getByText(/It isn't one of this account's payments/)).toBeTruthy();
		unmount();

		renderPage(null);
		expect(screen.getByText(/This link doesn't say which payment it is/)).toBeTruthy();
		expect(api.payment).toHaveBeenCalledTimes(1);
	});
});
