// What an AI operation costs on Rezumi AI: a listing's fit check costs what the workspace's Fit check costs.
import { CAREER_TASK_CREDIT_ACTIONS } from "@rezumi/schema/billing";
import { creditActionOf } from "./ai-source";

describe("creditActionOf", () => {
	it("prices a job listing's fit check as the workspace's Fit", () => {
		expect(creditActionOf("jobs.checkFit", { id: "l1" })).toBe(CAREER_TASK_CREDIT_ACTIONS.fit);
		expect(creditActionOf("jobs.search", {})).toBeUndefined();
	});
});
