import { describe, expect, it } from "vite-plus/test";
import { aiChoice, aiFields, creditCost, showsCredits } from "./ai";

const managed = { id: "server", managed: true, enabled: true, testStatus: "success" as const };
const own = { id: "mine", managed: false, enabled: true, testStatus: "success" as const };
const untested = { id: "draft", managed: false, enabled: true, testStatus: "untested" as const };
const credits = (balance: number) => ({
	balance,
	nextExpiry: null,
	trial: { available: false, grantedAt: null, expiresAt: null },
});

describe("aiChoice", () => {
	it("hides credits while billing is off: the server's default runs, nothing is chosen", () => {
		const off = aiChoice({ enabled: false, credits: null }, [managed, own], null);
		expect(off).toMatchObject({ choice: false, source: "own" });
		expect(showsCredits(off)).toBe(false);
		expect(aiFields(off, "key")).toEqual({});
	});

	it("chooses Rezumi AI with credits while billing is on, showing the balance", () => {
		const on = aiChoice({ enabled: true, credits: credits(12) }, [managed], null);
		expect(on).toMatchObject({ choice: true, source: "rezumi", balance: 12, hasOwn: false });
		expect(showsCredits(on)).toBe(true);
		expect(aiFields(on, "key")).toEqual({ aiSource: "rezumi", idempotencyKey: "key" });
	});

	it("keeps the person's own connection when they picked it, and only when it works", () => {
		expect(aiChoice({ enabled: true, credits: credits(0) }, [managed, own], "own")).toMatchObject({
			source: "own",
			hasOwn: true,
		});
		expect(aiChoice({ enabled: true, credits: credits(0) }, [managed, untested], "own").source).toBe("rezumi");
	});

	it("has no AI to run without a usable connection", () => {
		expect(aiChoice({ enabled: false, credits: null }, [untested], null).source).toBeNull();
		expect(aiChoice(undefined, undefined, null).source).toBeNull();
	});

	it("knows the costs the panel shows", () => {
		expect(creditCost("short-text")).toBe(1);
		expect(creditCost("review")).toBe(4);
	});
});
