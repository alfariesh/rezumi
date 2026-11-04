import { describe, expect, it } from "vite-plus/test";
import { planPageColumns } from "./builder";

describe("planPageColumns", () => {
	const page = { fullWidth: false, main: ["experience"], sidebar: ["skills"] };

	it("splits the page only for a two-column template with sidebar sections", () => {
		expect(planPageColumns(page, "jejak")).toEqual({ kind: "split" });
		expect(planPageColumns({ ...page, sidebar: [] }, "jejak")).toEqual({ kind: "single", sections: ["experience"] });
	});

	it("prints a one-column template's sidebar after the main sections, as the PDF does", () => {
		expect(planPageColumns(page, "meridian")).toEqual({ kind: "single", sections: ["experience", "skills"] });
	});

	it("prints no sidebar on a full-width page, as the PDF does", () => {
		expect(planPageColumns({ ...page, fullWidth: true }, "jejak")).toEqual({
			kind: "single",
			sections: ["experience"],
		});
		expect(planPageColumns({ ...page, fullWidth: true }, "meridian")).toEqual({
			kind: "single",
			sections: ["experience"],
		});
	});
});
