import { parseDeepLink } from "./parse";

describe("parseDeepLink (development builds)", () => {
	it("opens the design-system gallery with a known group only", () => {
		const server = "http://localhost:3400";
		for (const input of ["app.rezumi://dev/ui", "/dev/ui"])
			expect(parseDeepLink(input, server)).toEqual({ kind: "target", server: null, href: "/dev/ui" });
		expect(parseDeepLink("app.rezumi://dev/ui?group=fields", server)).toMatchObject({ href: "/dev/ui?group=fields" });
		expect(parseDeepLink("app.rezumi://dev/ui?group=../x", server)).toMatchObject({ href: "/dev/ui" });
		expect(parseDeepLink("app.rezumi://dev/other", server)).toBeNull();
	});
});
