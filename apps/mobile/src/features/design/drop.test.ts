import { dropAt } from "./drop";

const zones = [
	{
		page: 0,
		column: "main" as const,
		top: 0,
		bottom: 200,
		rows: [
			{ top: 10, bottom: 50 },
			{ top: 60, bottom: 100 },
		],
	},
	{ page: 0, column: "sidebar" as const, top: 300, bottom: 400, rows: [] },
];

describe("dropAt", () => {
	it("finds the zone under the finger and the row it goes before", () => {
		expect(dropAt(zones, 20)).toEqual({ page: 0, column: "main", index: 0 });
		expect(dropAt(zones, 90)).toEqual({ page: 0, column: "main", index: 2 });
		expect(dropAt(zones, 350)).toEqual({ page: 0, column: "sidebar", index: 0 });
	});

	it("uses the nearest zone between and beyond them, and nothing without zones", () => {
		expect(dropAt(zones, 280)?.column).toBe("sidebar");
		expect(dropAt(zones, 210)?.column).toBe("main");
		expect(dropAt([], 10)).toBeNull();
	});
});
