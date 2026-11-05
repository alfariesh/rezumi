// @vitest-environment happy-dom

import type { PlanSummary } from "./plan";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const dialog = vi.hoisted(() => ({ choice: null as { planId: string; interval: string } | null }));
const context = vi.hoisted(() => ({ smtpEnabled: true }));

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
vi.mock("@/libs/auth/client", () => ({ authClient: { sendVerificationEmail: vi.fn() } }));
vi.mock("./purchase-dialog", () => ({
	PurchaseDialog: ({ choice }: { choice: { planId: string; interval: string } | null }) => {
		dialog.choice = choice;
		return null;
	},
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: { callbackURL?: string } }) => (
		<a href={search?.callbackURL ? `${to}?callbackURL=${search.callbackURL}` : to}>{children}</a>
	),
	useRouteContext: () => ({
		flags: { smtpEnabled: context.smtpEnabled },
		session: { user: { email: "sari@example.test" } },
	}),
}));

i18n.loadAndActivate({ locale: "en", messages: {} });

const { BuyPlansSection } = await import("./buy-plans");

type Subscription = NonNullable<PlanSummary["subscription"]>;

const subscribed = (patch: Partial<Subscription> = {}): Subscription => ({
	id: "sub",
	planId: "plus",
	interval: "month",
	status: "active",
	amount: 499,
	currency: "usd",
	currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
	currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
	cancelAtPeriodEnd: false,
	pendingChange: null,
	...patch,
});

const summary = (patch: Partial<PlanSummary>): PlanSummary => ({
	enabled: true,
	planId: "free",
	currentPeriodEndsAt: null,
	source: null,
	renews: false,
	subscription: null,
	currency: "usd",
	upcoming: [],
	limits: { activeResumes: { used: 0, max: 3 }, activeCoverLetters: { used: 0, max: 3 } },
	features: {
		premiumTemplates: false,
		brandLogos: false,
		wordOdtExport: false,
		customStyles: false,
		customFonts: false,
		automationApi: false,
	},
	credits: null,
	canPurchase: true,
	purchaseBlockedBy: null,
	pendingPayment: null,
	trialAvailable: false,
	...patch,
});

function renderSection(plan: PlanSummary, selected?: "plus" | "pro-ai") {
	return render(
		<I18nProvider i18n={i18n}>
			<BuyPlansSection plan={plan} selected={selected} />
		</I18nProvider>,
	);
}

// The plan buttons only: the monthly/yearly switch is a segmented control.
const PLAN_BUTTON = /^(Get|Try|Upgrade|Switch|Resend)/;
const buttons = () =>
	screen
		.queryAllByRole("button")
		.map((button) => button.textContent ?? "")
		.filter((text) => PLAN_BUTTON.test(text));

describe("subscribing", () => {
	beforeEach(() => {
		dialog.choice = null;
		context.smtpEnabled = true;
		Element.prototype.scrollIntoView = vi.fn();
	});

	it("offers both plans monthly on the free plan, at the visitor's price", () => {
		renderSection(summary({}));
		expect(buttons()).toEqual(["Get Plus", "Get Pro AI"]);
		expect(screen.getByText("$4.99")).toBeTruthy();
		expect(screen.getByText("$9.99")).toBeTruthy();
	});

	it("offers a first subscription to Plus as a free week, and says prices are before tax", () => {
		renderSection(summary({ trialAvailable: true }));
		expect(buttons()).toEqual(["Try Plus free", "Get Pro AI"]);
		expect(screen.getAllByText("First 7 days free")).toHaveLength(1);
		expect(screen.getByText(/Prices are before tax/)).toBeTruthy();
	});

	it("prices in Rupiah for visitors from Indonesia", () => {
		renderSection(summary({ currency: "idr" }));
		expect(screen.getByText(/IDR\s59,000/)).toBeTruthy();
		expect(screen.getByText(/IDR\s129,000/)).toBeTruthy();
	});

	it("marks the current plan and offers the upgrade while subscribed to Plus", () => {
		renderSection(summary({ planId: "plus", source: "subscription", renews: true, subscription: subscribed() }));
		expect(screen.getByText("Current")).toBeTruthy();
		expect(buttons()).toEqual(["Upgrade to Pro AI"]);
		fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro AI" }));
		expect(dialog.choice).toEqual({ planId: "pro-ai", interval: "month" });
	});

	it("starts on the subscription's interval, so a yearly Pro AI can switch down to Plus", () => {
		renderSection(
			summary({
				planId: "pro-ai",
				source: "subscription",
				renews: true,
				subscription: subscribed({ planId: "pro-ai", interval: "year", amount: 7_900 }),
			}),
		);
		expect(buttons()).toEqual(["Switch to Plus"]);
		expect(screen.getByText("$79")).toBeTruthy();
	});

	it("waits for a cancelled subscription to be kept before changing it", () => {
		renderSection(
			summary({ planId: "plus", source: "subscription", subscription: subscribed({ cancelAtPeriodEnd: true }) }),
		);
		expect(screen.getByRole("button", { name: "Upgrade to Pro AI" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Your subscription is set to end. Keep it first to change the plan.")).toBeTruthy();
	});

	it("marks and brings forward the plan a link asked for", () => {
		renderSection(summary({}), "plus");
		expect(screen.getByText("Selected")).toBeTruthy();
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
	});

	it("shows a guest how to get an account instead of a way to pay", () => {
		renderSection(summary({ canPurchase: false, purchaseBlockedBy: "guest" }));
		expect(buttons()).toEqual([]);
		expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
			"/auth/register?callbackURL=/dashboard/settings/billing",
		);
	});

	it("asks an unverified account to verify first, with a new link on request", () => {
		renderSection(summary({ canPurchase: false, purchaseBlockedBy: "email_not_verified" }));
		expect(screen.getByText("Verify your email to subscribe")).toBeTruthy();
		expect(buttons()).toEqual(["Resend the link"]);
	});

	it("says subscribing is paused without offering it", () => {
		renderSection(summary({ canPurchase: false, purchaseBlockedBy: "paused" }));
		expect(screen.getByText("Subscribing is paused for now")).toBeTruthy();
		expect(buttons()).toEqual([]);
	});

	it("shows nothing where plans aren't sold", () => {
		const { container } = renderSection(summary({ canPurchase: false, purchaseBlockedBy: "unavailable" }));
		expect(container.textContent).toBe("");
	});
});
