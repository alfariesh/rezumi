// Plan refusals the client explains in an alert: only the document limits (and features); the job search's daily
// limit and the job alert limit are explained where they happen.
import { ORPCError } from "@orpc/client";
import { getPlanProblem } from "./plan-alert";

describe("getPlanProblem", () => {
	it("reads the document limits", () => {
		expect(
			getPlanProblem(new ORPCError("PLAN_LIMIT_REACHED", { data: { limit: "activeCoverLetters", max: 3 } })),
		).toMatchObject({
			kind: "limit",
			limit: "activeCoverLetters",
			max: 3,
		});
		expect(getPlanProblem(new ORPCError("PLAN_LIMIT_REACHED", { data: {} }))).toMatchObject({ limit: "activeResumes" });
	});

	it("leaves the job search and job alert limits to their screens", () => {
		expect(getPlanProblem(new ORPCError("PLAN_LIMIT_REACHED", { data: { limit: "jobSearchesPerDay" } }))).toBeNull();
		expect(getPlanProblem(new ORPCError("PLAN_LIMIT_REACHED", { data: { limit: "jobAlerts" } }))).toBeNull();
	});
});
