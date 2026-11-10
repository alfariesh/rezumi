import { mockRpc } from "../fixtures/rpc";
import { expect, test } from "../fixtures/test";

const PAYMENT_ID = "01a19ef4-a65a-7256-91f4-54f7c9b40fbf";
const CHECKOUT_URL = "https://test.checkout.dodopayments.com/session/cks_e2e";
const DAY_MS = 24 * 60 * 60 * 1000;

// Billing stays off on the test server: the browser answers the billing procedures itself, and Dodo Payments' checkout
// is stood in for, so nothing here reaches Dodo.
test("subscribes to Pro AI: confirm, pay on Dodo Payments, come back to an active plan", async ({
	authPage: page,
	baseURL,
}) => {
	const now = new Date();
	const periodEnd = new Date(+now + 30 * DAY_MS);
	const checkouts: unknown[] = [];
	let paymentChecks = 0;
	let paid = false;

	const payment = () => ({
		id: PAYMENT_ID,
		method: "card",
		providerPaymentId: paid ? "pay_e2e" : null,
		planId: "pro-ai",
		interval: "month",
		durationDays: null,
		billingReason: "subscription_create",
		amount: 999,
		taxAmount: 0,
		totalAmount: 999,
		currency: "usd",
		credits: paid ? 100 : 0,
		status: paid ? "paid" : "pending",
		createdAt: now,
		expiresAt: new Date(+now + DAY_MS),
		paidAt: paid ? now : null,
		periodStart: paid ? now : null,
		periodEnd: paid ? periodEnd : null,
		refundedAmount: 0,
		redirectUrl: paid ? null : CHECKOUT_URL,
	});

	const subscription = () => ({
		id: "sub_e2e",
		planId: "pro-ai",
		interval: "month",
		status: "active",
		amount: 999,
		currency: "usd",
		currentPeriodStart: now,
		currentPeriodEnd: periodEnd,
		cancelAtPeriodEnd: false,
		pendingChange: null,
	});

	await mockRpc(page, {
		"billing/summary": () => ({
			enabled: true,
			planId: paid ? "pro-ai" : "free",
			currentPeriodEndsAt: paid ? periodEnd : null,
			source: paid ? "subscription" : null,
			renews: paid,
			subscription: paid ? subscription() : null,
			currency: "usd",
			paymentMethods: ["card"],
			paymentMethod: paid ? "card" : null,
			upcoming: [],
			limits: {
				activeResumes: { used: 0, max: paid ? 50 : 3 },
				activeCoverLetters: { used: 0, max: paid ? 50 : 3 },
			},
			features: {
				premiumTemplates: paid,
				brandLogos: paid,
				wordOdtExport: paid,
				customStyles: paid,
				customFonts: paid,
				automationApi: paid,
			},
			credits: {
				balance: paid ? 100 : 0,
				nextExpiry: paid ? { credits: 100, at: periodEnd } : null,
				trial: { available: true, grantedAt: null, expiresAt: null },
			},
			canPurchase: true,
			purchaseBlockedBy: null,
			pendingPayment: null,
		}),
		"billing/creditHistory": () => ({ items: [], hasMore: false }),
		"billing/payments": () => ({ items: paid ? [payment()] : [], nextCursor: null }),
		"billing/checkout": (input) => {
			checkouts.push(input);
			return { paymentId: PAYMENT_ID, redirectUrl: CHECKOUT_URL, expiresAt: new Date(+now + DAY_MS), reused: false };
		},
		"billing/payment": () => {
			// Still pending on the first look, as when the customer is back before Dodo's webhook lands.
			paymentChecks += 1;
			if (paymentChecks > 1) paid = true;
			return payment();
		},
	});

	// Dodo sends the customer back to the return URL with the payment's id and status in the query; the page asks the
	// server.
	const returnUrl = `${baseURL}/dashboard/settings/billing/return/${PAYMENT_ID}?subscription_id=sub_e2e&status=active`;
	await page.route("https://test.checkout.dodopayments.com/**", (route) =>
		route.fulfill({ contentType: "text/html", body: `<a href="${returnUrl}">Back to Rezumi</a>` }),
	);

	await page.goto("/dashboard/settings/billing?plan=pro-ai");
	await expect(page.getByText("Selected", { exact: true })).toBeVisible();
	await expect(page.getByText(/^\$9\.99 \/ month$/)).toBeVisible();
	await page.getByRole("button", { name: "Get Pro AI" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Renews every month until you cancel.")).toBeVisible();
	await expect(dialog.getByText(/100 credits for Rezumi AI every month/)).toBeVisible();
	await expect(dialog.getByRole("link", { name: "Refund policy" })).toBeVisible();
	await dialog.getByRole("button", { name: "Continue to checkout" }).dblclick();

	await page.waitForURL(/test\.checkout\.dodopayments\.com/);
	expect(checkouts).toHaveLength(1);
	expect(checkouts[0]).toMatchObject({ planId: "pro-ai", interval: "month", idempotencyKey: expect.any(String) });

	await page.getByRole("link", { name: "Back to Rezumi" }).click();
	await expect(page.getByText("Waiting for your payment")).toBeVisible();
	await expect(page.getByRole("link", { name: "Continue checkout" })).toHaveAttribute("href", CHECKOUT_URL);
	await expect(page.getByText("Payment received")).toBeVisible();
	await expect(page.getByText("100 credits added for Rezumi AI.")).toBeVisible();

	await page.goto("/dashboard/settings/billing");
	await expect(page.getByText(/Renews monthly on/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Billing and invoices" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Cancel subscription" })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Payments" }).getByRole("button", { name: "Invoice" })).toBeVisible();
});

const QRIS_URL = "https://pay.sumopod.com/pay/6f1c2a4e-0000-4000-8000-0000000000e2";

// From Indonesia: QRIS in Rupiah first, a 30-day pass that doesn't renew, paid on Sumopod's QRIS page (stood in for), and
// Rezumi's own receipt afterwards. Billing stays off on the test server, so the browser answers the procedures.
test("buys a 30-day Plus pass with QRIS from Indonesia and gets Rezumi's receipt", async ({
	authPage: page,
	baseURL,
}) => {
	const now = new Date();
	const periodEnd = new Date(+now + 30 * DAY_MS);
	const checkouts: unknown[] = [];
	let paymentChecks = 0;
	let paid = false;

	const payment = () => ({
		id: PAYMENT_ID,
		method: "qris",
		providerPaymentId: paid ? "6f1c2a4e-0000-4000-8000-0000000000e2" : null,
		planId: "plus",
		interval: "month",
		durationDays: 30,
		billingReason: "purchase",
		amount: 2_900_000,
		taxAmount: 0,
		totalAmount: 2_900_000,
		currency: "idr",
		credits: 0,
		status: paid ? "paid" : "pending",
		createdAt: now,
		expiresAt: new Date(+now + 60 * 60 * 1000),
		paidAt: paid ? now : null,
		periodStart: paid ? now : null,
		periodEnd: paid ? periodEnd : null,
		refundedAmount: 0,
		redirectUrl: paid ? null : QRIS_URL,
		trialDays: null,
	});

	await mockRpc(page, {
		"billing/summary": () => ({
			enabled: true,
			planId: paid ? "plus" : "free",
			currentPeriodEndsAt: paid ? periodEnd : null,
			source: paid ? "period" : null,
			renews: false,
			subscription: null,
			currency: "idr",
			paymentMethods: paid ? ["qris"] : ["qris", "card"],
			paymentMethod: paid ? "qris" : null,
			upcoming: [],
			limits: {
				activeResumes: { used: 0, max: paid ? 50 : 3 },
				activeCoverLetters: { used: 0, max: paid ? 50 : 3 },
			},
			features: {
				premiumTemplates: paid,
				brandLogos: paid,
				wordOdtExport: paid,
				customStyles: paid,
				customFonts: paid,
				automationApi: paid,
			},
			credits: { balance: 0, nextExpiry: null, trial: { available: true, grantedAt: null, expiresAt: null } },
			canPurchase: true,
			purchaseBlockedBy: null,
			pendingPayment: null,
			trialAvailable: !paid,
		}),
		"billing/creditHistory": () => ({ items: [], hasMore: false }),
		"billing/payments": () => ({ items: paid ? [payment()] : [], nextCursor: null }),
		"billing/previewPass": () => ({
			amount: 2_900_000,
			currency: "idr",
			days: 30,
			creditsPerMonth: 0,
			stretches: [{ planId: "plus", startsAt: now, endsAt: periodEnd, purchase: true }],
		}),
		"billing/checkout": (input) => {
			checkouts.push(input);
			return {
				paymentId: PAYMENT_ID,
				redirectUrl: QRIS_URL,
				expiresAt: new Date(+now + 60 * 60 * 1000),
				reused: false,
			};
		},
		"billing/payment": () => {
			// Still pending on the first look, as when the buyer is back before Sumopod's webhook lands.
			paymentChecks += 1;
			if (paymentChecks > 1) paid = true;
			return payment();
		},
	});

	const returnUrl = `${baseURL}/dashboard/settings/billing/return/${PAYMENT_ID}`;
	await page.route("https://pay.sumopod.com/**", (route) =>
		route.fulfill({ contentType: "text/html", body: `<a href="${returnUrl}">Back to Rezumi</a>` }),
	);

	await page.goto("/dashboard/settings/billing?plan=plus");
	await expect(page.getByText(/^IDR\s29,000 \/ 30 days$/)).toBeVisible();
	await expect(page.getByText("Prices are final: no tax is added.")).toBeVisible();
	await expect(page.getByText("First 7 days free")).toHaveCount(0);
	await page.getByRole("button", { name: "Get Plus" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText(/One payment by QRIS\. It doesn't renew/)).toBeVisible();
	await expect(dialog.getByText(/Scan the QR code on the next page/)).toBeVisible();
	await dialog.getByRole("button", { name: /Pay IDR\s29,000 with QRIS/ }).dblclick();

	await page.waitForURL(/pay\.sumopod\.com/);
	expect(checkouts).toHaveLength(1);
	expect(checkouts[0]).toMatchObject({ planId: "plus", interval: "month", method: "qris" });

	await page.getByRole("link", { name: "Back to Rezumi" }).click();
	await expect(page.getByText("Waiting for your payment")).toBeVisible();
	await expect(page.getByRole("link", { name: "Continue paying" })).toHaveAttribute("href", QRIS_URL);
	await expect(page.getByText("Payment received")).toBeVisible();
	await expect(page.getByText(/Plus is active until .*It doesn't renew on its own/)).toBeVisible();

	await page.getByRole("link", { name: "Receipt" }).click();
	await expect(page.getByRole("heading", { name: "Payment receipt" })).toBeVisible();
	await expect(page.getByText(`RZ-${PAYMENT_ID}`)).toBeVisible();
	await expect(page.getByText(/this receipt is not a tax invoice/)).toBeVisible();

	await page.goto("/dashboard/settings/billing");
	await expect(page.getByText(/Paid with QRIS; active until/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Add 30 days" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);
});
