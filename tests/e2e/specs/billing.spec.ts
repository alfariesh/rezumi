import { mockRpc } from "../fixtures/rpc";
import { expect, test } from "../fixtures/test";

const PAYMENT_ID = "01a19ef4-a65a-7256-91f4-54f7c9b40fbf";
const CHECKOUT_URL = "https://sandbox.polar.sh/checkout/polar_c_e2e";
const DAY_MS = 24 * 60 * 60 * 1000;

// Billing stays off on the test server: the browser answers the billing procedures itself, and Polar's checkout is
// stood in for, so nothing here reaches Polar.
test("subscribes to Pro AI: confirm, pay on Polar, come back to an active plan", async ({
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
		orderId: paid ? "order_e2e" : null,
		planId: "pro-ai",
		interval: "month",
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
			// Still pending on the first look, as when the customer is back before Polar's webhook lands.
			paymentChecks += 1;
			if (paymentChecks > 1) paid = true;
			return payment();
		},
	});

	// Polar sends the customer back to the success URL with the checkout id in the query; the page asks the server.
	const returnUrl = `${baseURL}/dashboard/settings/billing/return/${PAYMENT_ID}?checkout_id=polar_c_e2e`;
	await page.route("https://sandbox.polar.sh/**", (route) =>
		route.fulfill({ contentType: "text/html", body: `<a href="${returnUrl}">Back to Rezumi</a>` }),
	);

	await page.goto("/dashboard/settings/billing?plan=pro-ai");
	await expect(page.getByText("Selected", { exact: true })).toBeVisible();
	await expect(page.getByText("$9.99", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Get Pro AI" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Renews every month until you cancel.")).toBeVisible();
	await expect(dialog.getByText(/100 credits for Rezumi AI every month/)).toBeVisible();
	await expect(dialog.getByRole("link", { name: "Refund policy" })).toBeVisible();
	await dialog.getByRole("button", { name: "Continue to checkout" }).dblclick();

	await page.waitForURL(/sandbox\.polar\.sh/);
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
