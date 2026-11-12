import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { fromWholeRupiah, orderIdFor, paymentIdFromOrder, paymentStatusOf, toWholeRupiah } from "./mapping";
import { signSumopodPayload, verifySumopodSignature } from "./signature";

const secretBytes = randomBytes(24);
const secret = `whsec_${secretBytes.toString("base64")}`;
const body = JSON.stringify({ event_type: "payment.completed", data: { payment_id: "p_1", amount: 29000 } });
const now = new Date("2026-11-10T05:00:00Z");
const timestamp = String(Math.floor(+now / 1000));

/** The signature as Sumopod's own Node example computes it (Managed Payment → Quick Start). */
const sumopodSigns = (id: string, at: string, payload: string, key = secretBytes) =>
	createHmac("sha256", key).update(`${id}.${at}.${payload}`).digest("base64");

describe("Sumopod webhook signatures", () => {
	it("signs exactly as Sumopod's example does", async () => {
		expect(await signSumopodPayload({ secret, id: "msg_1", timestamp, body })).toBe(
			sumopodSigns("msg_1", timestamp, body),
		);
	});

	it("accepts a delivery signed with the secret, among several signatures after a roll", async () => {
		const signature = `v1,${sumopodSigns("msg_1", timestamp, body)}`;
		expect(await verifySumopodSignature({ secret, id: "msg_1", timestamp, signature, body, now })).toBe(true);
		const rolled = `v1,${sumopodSigns("msg_1", timestamp, body, randomBytes(24))} ${signature}`;
		expect(await verifySumopodSignature({ secret, id: "msg_1", timestamp, signature: rolled, body, now })).toBe(true);
	});

	it.each([
		["another secret", { signature: `v1,${sumopodSigns("msg_1", timestamp, body, randomBytes(24))}` }],
		["a changed body", { body: body.replace("29000", "1") }],
		["another delivery id", { id: "msg_2" }],
		["an old timestamp", { now: new Date(+now + 6 * 60 * 1000) }],
		["a future timestamp", { now: new Date(+now - 6 * 60 * 1000) }],
		["no signature", { signature: "" }],
		["another scheme", { signature: `v2,${sumopodSigns("msg_1", timestamp, body)}` }],
		["a broken timestamp", { timestamp: "soon" }],
		["a secret that isn't base64", { secret: "whsec_%%%" }],
	])("refuses %s", async (_label, change) => {
		const input = {
			secret,
			id: "msg_1",
			timestamp,
			signature: `v1,${sumopodSigns("msg_1", timestamp, body)}`,
			body,
			now,
			...change,
		};
		expect(await verifySumopodSignature(input)).toBe(false);
	});
});

describe("Sumopod mapping", () => {
	it("names orders after Rezumi's payment ids and reads them back", () => {
		const id = "019a6b2e-7c1d-7f00-8a00-0123456789ab";
		expect(orderIdFor(id)).toBe(`RZ-${id}`);
		expect(paymentIdFromOrder(`RZ-${id}`)).toBe(id);
		expect(paymentIdFromOrder(` rz-${id.toUpperCase()} `)).toBe(id);
		expect(paymentIdFromOrder("INV-2026-001")).toBeNull();
		expect(paymentIdFromOrder(null)).toBeNull();
	});

	it("reads Sumopod's statuses as Rezumi's", () => {
		expect(paymentStatusOf("completed")).toBe("paid");
		expect(paymentStatusOf("COMPLETED")).toBe("paid");
		expect(paymentStatusOf("pending")).toBe("pending");
		expect(paymentStatusOf("failed")).toBe("failed");
		expect(paymentStatusOf("expired")).toBe("expired");
		expect(paymentStatusOf("refund_review")).toBeNull();
	});

	it("turns the catalog's Rupiah (two decimals) into whole Rupiah and back", () => {
		expect(toWholeRupiah(2_900_000)).toBe(29_000);
		expect(fromWholeRupiah(499_000)).toBe(49_900_000);
	});
});
