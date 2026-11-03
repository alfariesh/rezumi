// @vitest-environment happy-dom

import type { PlanSummary } from "./plan";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

const dialog = vi.hoisted(() => ({ planId: null as string | null }));
const context = vi.hoisted(() => ({ smtpEnabled: true }));

vi.mock("@/libs/orpc/client", () => ({ orpc: {} }));
vi.mock("@/libs/auth/client", () => ({ authClient: { sendVerificationEmail: vi.fn() } }));
vi.mock("./purchase-dialog", () => ({
	PurchaseDialog: ({ planId }: { planId: string | null }) => {
		dialog.planId = planId;
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

const summary = (patch: Partial<PlanSummary>): PlanSummary => ({
	enabled: true,
	planId: "free",
	currentPeriodEndsAt: null,
	upcoming: [],
	limits: { activeResumes: { used: 0, max: 3 }, activeCoverLetters: { used: 0, max: 3 } },
	features: {
		premiumTemplates: false,
		wordOdtExport: false,
		customStyles: false,
		customFonts: false,
		automationApi: false,
	},
	credits: null,
	canPurchase: true,
	purchaseBlockedBy: null,
	pendingPayment: null,
	...patch,
});

function renderSection(plan: PlanSummary, selected?: "plus" | "pro-ai") {
	return render(
		<I18nProvider i18n={i18n}>
			<BuyPlansSection plan={plan} selected={selected} />
		</I18nProvider>,
	);
}

const buttons = () => screen.queryAllByRole("button").map((button) => button.textContent);

describe("buying a pass", () => {
	beforeEach(() => {
		dialog.planId = null;
		context.smtpEnabled = true;
		Element.prototype.scrollIntoView = vi.fn();
	});

	it("offers both passes on the free plan, with their final price", () => {
		renderSection(summary({}));
		expect(buttons()).toEqual(["Buy Plus", "Buy Pro AI"]);
		expect(screen.getByText(/IDR\s29,000/)).toBeTruthy();
		expect(screen.getByText(/IDR\s79,000/)).toBeTruthy();
	});

	it("extends Plus or upgrades to Pro AI while Plus runs", () => {
		renderSection(summary({ planId: "plus" }));
		expect(buttons()).toEqual(["Extend 30 days", "Upgrade to Pro AI"]);
	});

	it("queues Plus behind a running Pro AI and extends Pro AI", () => {
		renderSection(summary({ planId: "pro-ai" }));
		expect(buttons()).toEqual(["Buy Plus", "Extend 30 days"]);
		expect(screen.getByText("Starts after your Pro AI time ends.")).toBeTruthy();
	});

	it("confirms the pass that was clicked", () => {
		renderSection(summary({ planId: "plus" }));
		fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro AI" }));
		expect(dialog.planId).toBe("pro-ai");
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
		expect(screen.getByText("Verify your email to buy a pass")).toBeTruthy();
		expect(buttons()).toEqual(["Resend the link"]);
	});

	it("says buying is paused without offering it", () => {
		renderSection(summary({ canPurchase: false, purchaseBlockedBy: "paused" }));
		expect(screen.getByText("Buying is paused for now")).toBeTruthy();
		expect(buttons()).toEqual([]);
	});

	it("shows nothing where buying doesn't apply", () => {
		const { container } = renderSection(summary({ canPurchase: false, purchaseBlockedBy: "unavailable" }));
		expect(container.textContent).toBe("");
	});
});
