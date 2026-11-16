import type { AssistantDocument } from "./document";
import { describe, expect, it } from "vite-plus/test";
import { sentContext } from "./chat";

const portfolio = (focus: { workId: string; title: string } | null) =>
	({
		kind: "portfolio",
		id: "p1",
		name: "Portfolio",
		locked: false,
		posting: null,
		source: { from: null, resume: null, messages: {} as never },
		reveal: () => {},
		focus,
	}) satisfies AssistantDocument;

describe("sentContext", () => {
	it("sends the open work's id while its chip is on", () => {
		expect(sentContext({ document: true, posting: true }, portfolio({ workId: "w1", title: "Kopi" }))).toEqual({
			document: true,
			posting: true,
			workId: "w1",
		});
	});

	it("leaves the work out once its chip is removed, or outside Work", () => {
		expect(
			sentContext({ document: true, posting: true, work: false }, portfolio({ workId: "w1", title: "Kopi" })),
		).toEqual({ document: true, posting: true });
		expect(sentContext({ document: true, posting: true, workId: "old" }, portfolio(null))).toEqual({
			document: true,
			posting: true,
		});
	});
});
