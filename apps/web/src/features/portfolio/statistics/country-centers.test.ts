import type { City } from "../location/cities";
import { describe, expect, it } from "vite-plus/test";
import { countryCenters } from "./country-centers";

const city = (country: string, lat: number, lng: number): City => ({
	name: "x",
	ascii: "x",
	country,
	region: "",
	lat,
	lng,
	timezone: "UTC",
});

describe("countryCenters", () => {
	it("puts a country's dot at the middle of its cities", () => {
		const centers = countryCenters([city("ID", -6, 106), city("ID", -8, 110), city("SG", 1.3, 103.8)]);
		expect(centers.get("ID")).toEqual({ lat: -7, lng: 108 });
		expect(centers.get("SG")).toEqual({ lat: 1.3, lng: 103.8 });
		expect(centers.get("FR")).toBeUndefined();
	});
});
