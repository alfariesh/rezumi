import type { City } from "./cities";
import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { areaCenter, cityLabel, countryNames, parseCities } from "./cities";
import { identifyPlace, isCoarser, isPlaceOf, placeAtPrecision } from "./place";

const list = parseCities(readFileSync(new URL("./cities.txt", import.meta.url), "utf8"));
const english = countryNames("en-US");
const city = (name: string, country: string) =>
	list.find((entry) => entry.name === name && entry.country === country) as City;

type Precision = NonNullable<PortfolioLocation["point"]>["precision"];

/** A location saved for a city at a precision, as the form saves it. */
const saved = (chosen: City, precision: Precision) => ({
	point: { ...areaCenter(list, chosen, precision), precision },
	label: cityLabel(chosen, precision, english),
});

const losAngeles = city("Los Angeles", "US");
const bandung = city("Bandung", "ID");
const perth = city("Perth", "AU");

describe("changing how precise a location is, after a reload", () => {
	it("goes coarser from a city: the province and country of that city, never a neighbour's", () => {
		const place = identifyPlace(list, saved(losAngeles, "city"), null);
		expect(place?.city).toBe(losAngeles);
		expect(placeAtPrecision(list, place, "region", english)).toEqual({
			point: { ...areaCenter(list, losAngeles, "region"), precision: "region" },
			label: "California, United States",
		});
		expect(placeAtPrecision(list, place, "country", english)?.label).toBe("United States");
	});

	it("needs the city picked again for a finer precision, instead of guessing one from an area's centre", () => {
		// Before: Los Angeles saved as "United States" came back as Fort Leonard Wood, Missouri, in another time zone.
		for (const chosen of [losAngeles, bandung, perth]) {
			const country = identifyPlace(list, saved(chosen, "country"), null);
			expect(country, chosen.name).toEqual({ country: chosen.country });
			expect(placeAtPrecision(list, country, "region", english), chosen.name).toBeNull();
			expect(placeAtPrecision(list, country, "city", english), chosen.name).toBeNull();
		}
		const region = identifyPlace(list, saved(bandung, "region"), null);
		expect(region).toEqual({ country: "ID", region: "West Java" });
		expect(placeAtPrecision(list, region, "city", english)).toBeNull();
		expect(placeAtPrecision(list, region, "country", english)?.label).toBe("Indonesia");
	});

	it("goes back and forth freely while the city picked in this visit is known", () => {
		const atCountry = saved(perth, "country");
		const place = identifyPlace(list, atCountry, perth);
		expect(place?.city).toBe(perth);
		expect(placeAtPrecision(list, place, "region", english)?.label).toBe("Western Australia, Australia");
		expect(placeAtPrecision(list, place, "city", english)).toEqual({
			point: { lat: perth.lat, lng: perth.lng, precision: "city" },
			label: "Perth, Australia",
		});
		// A city picked earlier but no longer shown (Undo went back to another place) isn't used.
		expect(identifyPlace(list, saved(bandung, "country"), perth)).toEqual({ country: "ID" });
	});

	it("knows a city by its pin dragged around it, while the label still names it", () => {
		const dragged = { point: { lat: bandung.lat + 0.03, lng: bandung.lng - 0.02, precision: "city" as const } };
		expect(identifyPlace(list, { ...dragged, label: "Bandung, Indonesia" }, null)?.city).toBe(bandung);
		expect(identifyPlace(list, { ...dragged, label: "Near my office" }, null)).toBeNull();
		expect(isPlaceOf(list, bandung, dragged.point)).toBe(true);
		expect(isPlaceOf(list, bandung, { lat: bandung.lat + 2, lng: bandung.lng, precision: "city" })).toBe(false);
	});

	it("never sets a time zone: only picking a city does", () => {
		const change = placeAtPrecision(list, identifyPlace(list, saved(losAngeles, "city"), null), "country", english);
		expect(change && Object.keys(change).sort()).toEqual(["label", "point"]);
	});

	it("orders precisions from the city outwards", () => {
		expect(isCoarser("country", "city")).toBe(true);
		expect(isCoarser("city", "region")).toBe(false);
	});
});
