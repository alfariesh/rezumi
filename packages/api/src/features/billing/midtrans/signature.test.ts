import { describe, expect, it } from "vite-plus/test";
import { notificationSignature, verifyNotificationSignature } from "./signature";

// Snap notification fixtures from the Midtrans integration skill, signed with the sandbox placeholder key.
const KEY = "SB-Mid-server-test";
const settlement = {
	order_id: "ORDER-sandbox-0001",
	status_code: "200",
	gross_amount: "150000.00",
	transaction_status: "settlement",
	signature_key:
		"d65b4adf15335095fe1bfafe24964d48009dcc2989393e13570b0c9852ea60df0040b1a9646b9c9ef9433317f77acc8e387c59998dc20f5bd93fff93d23672e4",
};
const pending = {
	order_id: "ORDER-sandbox-0002",
	status_code: "201",
	gross_amount: "75000.00",
	transaction_status: "pending",
	signature_key:
		"db70270f6c27da2b564d4fffd9df3eeae578a7afba22bf5e6071711c7914d7a3d22ccaa533e864cf53742ca73c9e63016b0cbc1f97ee253a77b24b7a410d876a",
};

describe("verifyNotificationSignature", () => {
	it.each([settlement, pending])("accepts the signed fixture for $transaction_status", (payload) => {
		expect(verifyNotificationSignature(payload, KEY)).toBe(true);
	});

	it("accepts an uppercase signature", () => {
		expect(
			verifyNotificationSignature({ ...settlement, signature_key: settlement.signature_key.toUpperCase() }, KEY),
		).toBe(true);
	});

	it("accepts a signature from any of the account's keys, and none from others", () => {
		// Newer Midtrans credentials sign with a Signature Secret Key; older accounts with the server key.
		const signed = notificationSignature({ orderId: "RZ-1", statusCode: "201", grossAmount: "79000.00" }, "SB-signing");
		const payload = { order_id: "RZ-1", status_code: "201", gross_amount: "79000.00", signature_key: signed };
		expect(verifyNotificationSignature(payload, ["SB-signing", KEY])).toBe(true);
		expect(verifyNotificationSignature(payload, [KEY, "SB-signing"])).toBe(true);
		expect(verifyNotificationSignature(payload, [KEY])).toBe(false);
		expect(verifyNotificationSignature(payload, [])).toBe(false);
	});

	it("rejects the right payload under another key", () => {
		expect(verifyNotificationSignature(settlement, "SB-Mid-server-other")).toBe(false);
	});

	it.each([
		["a changed status code", { status_code: "201" }],
		["a changed order", { order_id: "ORDER-sandbox-0003" }],
		["a reformatted amount", { gross_amount: "150000" }],
		["a numeric amount", { gross_amount: 150_000 }],
		["a short signature", { signature_key: "abc" }],
		["a missing signature", { signature_key: undefined }],
	])("rejects %s", (_name, change) => {
		expect(verifyNotificationSignature({ ...settlement, ...change }, KEY)).toBe(false);
	});

	it('hashes the amount as it came: "79000.00" and "79000" sign differently', () => {
		const signed = notificationSignature({ orderId: "RZ-1", statusCode: "200", grossAmount: "79000.00" }, KEY);
		const base = { order_id: "RZ-1", status_code: "200", signature_key: signed };
		expect(verifyNotificationSignature({ ...base, gross_amount: "79000.00" }, KEY)).toBe(true);
		expect(verifyNotificationSignature({ ...base, gross_amount: "79000" }, KEY)).toBe(false);
	});
});
