import { describe, expect, it } from "vite-plus/test";
import { allocateCredits, insufficientCredits } from "./credits";

describe("allocateCredits", () => {
	const grants = [
		{ id: "soon", remaining: 2 },
		{ id: "later", remaining: 10 },
	];

	it("takes from the soonest-expiring grant first and spills into the next", () => {
		expect(allocateCredits(grants, 1)).toEqual([{ grantId: "soon", credits: 1 }]);
		expect(allocateCredits(grants, 5)).toEqual([
			{ grantId: "soon", credits: 2 },
			{ grantId: "later", credits: 3 },
		]);
		expect(allocateCredits(grants, 12)).toEqual([
			{ grantId: "soon", credits: 2 },
			{ grantId: "later", credits: 10 },
		]);
	});

	it("refuses when the grants together hold too few, and skips empty ones", () => {
		expect(allocateCredits(grants, 13)).toBeNull();
		expect(allocateCredits([], 1)).toBeNull();
		expect(allocateCredits([{ id: "empty", remaining: 0 }, ...grants], 3)).toEqual([
			{ grantId: "soon", credits: 2 },
			{ grantId: "later", credits: 1 },
		]);
	});
});

describe("insufficientCredits", () => {
	it("says what is needed and left, without prices or buying", () => {
		const error = insufficientCredits(5, 1);
		expect(error).toMatchObject({ code: "INSUFFICIENT_CREDITS", status: 403, data: { required: 5, balance: 1 } });
		expect(error.message).toBe(
			"This needs 5 Rezumi AI credits and 1 is left. Your own AI connection works without credits.",
		);
		expect(error.message).not.toMatch(/Rp|buy|purchase|http/i);
		expect(insufficientCredits(1, 0).message).toContain("1 Rezumi AI credit and 0 are left");
	});
});
