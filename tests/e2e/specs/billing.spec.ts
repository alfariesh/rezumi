import { mockRpc } from "../fixtures/rpc";
import { expect, test } from "../fixtures/test";

const PAYMENT_ID = "01a19ef4-a65a-7256-91f4-54f7c9b40fbf";
const SNAP_URL = "https://app.sandbox.midtrans.com/snap/v4/redirection/e2e-token";
const DAY_MS = 24 * 60 * 60 * 1000;

// Billing stays off on the test server: the browser answers the billing procedures itself, and Midtrans' page is
// stood in for, so nothing here reaches Midtrans.
test("buys Pro AI: confirm, pay on Midtrans, come back to an active plan and a receipt", async ({
	authPage: page,
	baseURL,
}) => {
	const now = new Date();
	const accessEnd = new Date(+now + 30 * DAY_MS);
	const checkouts: unknown[] = [];
	let paymentChecks = 0;
	let paid = false;

	const payment = () => ({
		id: PAYMENT_ID,
		orderId: `RZ-${PAYMENT_ID}`,
		planId: "pro-ai",
		amount: 79_000,
		currency: "IDR",
		durationDays: 30,
		credits: 100,
		status: paid ? "paid" : "pending",
		paymentType: paid ? "qris" : null,
		createdAt: now,
		expiresAt: new Date(+now + DAY_MS),
		paidAt: paid ? now : null,
		refundedAmount: 0,
		redirectUrl: paid ? null : SNAP_URL,
		access: paid ? { startsAt: now, endsAt: accessEnd } : null,
	});

	await mockRpc(page, {
		"billing/summary": () => ({
			enabled: true,
			planId: paid ? "pro-ai" : "free",
			currentPeriodEndsAt: paid ? accessEnd : null,
			upcoming: [],
			limits: {
				activeResumes: { used: 0, max: paid ? 50 : 3 },
				activeCoverLetters: { used: 0, max: paid ? 50 : 3 },
			},
			features: {
				premiumTemplates: paid,
				wordOdtExport: paid,
				customStyles: paid,
				customFonts: paid,
				automationApi: paid,
			},
			credits: {
				balance: paid ? 100 : 0,
				nextExpiry: paid ? { credits: 100, at: accessEnd } : null,
				trial: { available: true, grantedAt: null, expiresAt: null },
			},
			canPurchase: true,
			purchaseBlockedBy: null,
			pendingPayment: null,
		}),
		"billing/creditHistory": () => ({ items: [], hasMore: false }),
		"billing/payments": () => ({ items: paid ? [payment()] : [], nextCursor: null }),
		"billing/previewPurchase": () => ({
			planId: "pro-ai",
			amount: 79_000,
			currency: "IDR",
			durationDays: 30,
			credits: 100,
			schedule: [{ planId: "pro-ai", startsAt: now, endsAt: accessEnd, purchase: true }],
		}),
		"billing/checkout": (input) => {
			checkouts.push(input);
			return { paymentId: PAYMENT_ID, redirectUrl: SNAP_URL, expiresAt: new Date(+now + DAY_MS), reused: false };
		},
		"billing/payment": () => {
			// Still pending on the first look, as when the customer is back before Midtrans settles.
			paymentChecks += 1;
			if (paymentChecks > 1) paid = true;
			return payment();
		},
	});

	// Midtrans sends the customer back with a trailing slash and its own query; the page must not trust the query.
	const returnUrl = `${baseURL}/dashboard/settings/billing/return/${PAYMENT_ID}/?order_id=RZ-${PAYMENT_ID}&status_code=200&transaction_status=settlement`;
	await page.route("https://app.sandbox.midtrans.com/**", (route) =>
		route.fulfill({ contentType: "text/html", body: `<a href="${returnUrl}">Back to merchant</a>` }),
	);

	await page.goto("/dashboard/settings/billing?plan=pro-ai");
	await expect(page.getByText("Selected", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Buy Pro AI" }).click();

	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("30 days of access, paid once. It doesn't renew on its own.")).toBeVisible();
	await expect(dialog.getByText("Pro AI starts")).toBeVisible();
	await expect(dialog.getByText("Once paid")).toBeVisible();
	await expect(dialog.getByRole("link", { name: "Refund policy" })).toBeVisible();
	await dialog.getByRole("button", { name: "Continue to payment" }).dblclick();

	await page.waitForURL(/app\.sandbox\.midtrans\.com/);
	expect(checkouts).toHaveLength(1);
	expect(checkouts[0]).toMatchObject({ planId: "pro-ai", idempotencyKey: expect.any(String) });

	await page.getByRole("link", { name: "Back to merchant" }).click();
	await expect(page.getByText("Waiting for your payment")).toBeVisible();
	await expect(page.getByRole("link", { name: "Continue payment" })).toHaveAttribute("href", SNAP_URL);
	await expect(page.getByText("Payment received")).toBeVisible();
	await expect(page.getByText("100 credits added for Rezumi AI.")).toBeVisible();

	await page.getByRole("link", { name: "View receipt" }).click();
	await expect(page.getByText(`RZ-${PAYMENT_ID}`)).toBeVisible();
	await expect(page.getByText(/this receipt is not a tax invoice/)).toBeVisible();

	await page.goto("/dashboard/settings/billing");
	await expect(page.getByRole("button", { name: "Extend 30 days" })).toBeVisible();
	await expect(page.getByRole("grid", { name: "Payments" }).getByRole("link", { name: "Receipt" })).toBeVisible();
});
