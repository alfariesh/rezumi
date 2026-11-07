import type { City } from "./cities";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
	areaCenter,
	areaPoint,
	cityLabel,
	countryNames,
	findCity,
	hasOnlyOtherScripts,
	MIN_AREA_CITIES,
	normalizePlace,
	parseCities,
	roundPoint,
	searchCities,
} from "./cities";

const fixture = [
	"# test list",
	"#zones\tAsia/Jakarta\tEurope/Madrid\tAmerica/Caracas",
	"#regions\tWest Java\tJakarta\tValencia\tCarabobo\tCentral Java",
	"Jakarta\t\tID\t1\t-6.21\t106.85\t0",
	"Valencia\t\tVE\t3\t10.16\t-68\t2",
	"Bandung\t\tID\t0\t-6.92\t107.61\t0",
	"Valencia\t\tES\t2\t39.47\t-0.38\t1",
	"Bandungan\t\tID\t4\t-7.23\t110.35\t0",
	"Kota Bandung Barat\t\tID\t0\t-6.84\t107.5\t0",
	"Málaga\tMalaga\tES\t2\t36.72\t-4.42\t1",
	"Bekasi\t\tID\t0\t-6.24\t107\t0",
	"Bogor\t\tID\t0\t-6.6\t106.8\t0",
	"Depok\t\tID\t0\t-6.4\t106.82\t0",
].join("\n");

const cities = parseCities(fixture);
const english = countryNames("en-US");
const byName = (list: readonly City[], name: string, country?: string) =>
	list.find((city) => city.name === name && (!country || city.country === country)) as City;

describe("parseCities", () => {
	it("reads every city with its region and time zone", () => {
		expect(cities).toHaveLength(10);
		expect(cities[2]).toEqual({
			name: "Bandung",
			ascii: "Bandung",
			country: "ID",
			region: "West Java",
			lat: -6.92,
			lng: 107.61,
			timezone: "Asia/Jakarta",
		});
		expect(cities[6]).toMatchObject({ name: "Málaga", ascii: "Malaga" });
	});
});

describe("searchCities", () => {
	it("finds names that start with the text first, then names with a word that does", () => {
		expect(searchCities(cities, "band", english).map((city) => city.name)).toEqual([
			"Bandung",
			"Bandungan",
			"Kota Bandung Barat",
		]);
	});

	it("lists every country that has a city of the same name, largest first", () => {
		expect(searchCities(cities, "Valencia", english).map((city) => city.country)).toEqual(["VE", "ES"]);
	});

	it("narrows by the region or country after a comma, in any of the languages given", () => {
		expect(searchCities(cities, "Valencia, Spain", english).map((city) => city.country)).toEqual(["ES"]);
		const languages = [countryNames("id-ID"), english];
		expect(searchCities(cities, "Valencia, Spanyol", languages).map((city) => city.country)).toEqual(["ES"]);
		expect(searchCities(cities, "Valencia, Spain", languages).map((city) => city.country)).toEqual(["ES"]);
		expect(searchCities(cities, "Valencia, carab", english).map((city) => city.country)).toEqual(["VE"]);
	});

	it("ignores accents and case", () => {
		expect(searchCities(cities, "malaga", english).map((city) => city.name)).toEqual(["Málaga"]);
		expect(normalizePlace("São-Paulo ")).toBe("sao paulo");
		expect(searchCities(cities, "  ", english)).toEqual([]);
	});

	it("knows a name typed in another script, which the list (Latin names) can't hold", () => {
		expect(hasOnlyOtherScripts("القاهرة")).toBe(true);
		expect(hasOnlyOtherScripts("Москва")).toBe(true);
		expect(hasOnlyOtherScripts("Malmö")).toBe(false);
		expect(hasOnlyOtherScripts("123")).toBe(false);
	});
});

describe("findCity", () => {
	it("reads a resume's location as a city, narrowed by its country", () => {
		expect(findCity(cities, "Bandung, Indonesia", english)?.name).toBe("Bandung");
		expect(findCity(cities, "Valencia, Spain", english)?.country).toBe("ES");
		expect(findCity(cities, "Valencia", english)?.country).toBe("VE");
		expect(findCity(cities, "Remote", english)).toBeNull();
	});
});

describe("cityLabel and areaCenter", () => {
	const bandung = byName(cities, "Bandung");

	it("labels by precision in the page's language", () => {
		expect(cityLabel(bandung, "city", english)).toBe("Bandung, Indonesia");
		expect(cityLabel(bandung, "region", english)).toBe("West Java, Indonesia");
		expect(cityLabel(bandung, "country", english)).toBe("Indonesia");
		expect(cityLabel(bandung, "country", countryNames("ar-SA"))).toBe("إندونيسيا");
		// A region named like its country isn't repeated.
		const jakarta = { ...byName(cities, "Jakarta"), region: "Indonesia" };
		expect(cityLabel(jakarta, "region", english)).toBe("Indonesia");
	});

	it("centres a region or country on its cities, not on the chosen city", () => {
		expect(areaCenter(cities, bandung, "city")).toEqual({ lat: -6.92, lng: 107.61 });
		// West Java: Bandung, Kota Bandung Barat, Bekasi, Bogor, Depok.
		expect(areaCenter(cities, bandung, "region")).toEqual({ lat: -6.6, lng: 107.15 });
		const country = areaCenter(cities, bandung, "country");
		expect(country).not.toEqual({ lat: bandung.lat, lng: bandung.lng });
		expect(country.lat).toBeCloseTo(-6.6, 1);
	});

	it(`centres a province of fewer than ${MIN_AREA_CITIES} listed cities on its country, never on its town`, () => {
		const bandungan = byName(cities, "Bandungan");
		expect(areaCenter(cities, bandungan, "region")).toEqual(areaCenter(cities, bandungan, "country"));
		expect(areaCenter(cities, bandungan, "region")).not.toEqual({ lat: bandungan.lat, lng: bandungan.lng });
	});

	it(`centres a country of fewer than ${MIN_AREA_CITIES} listed cities to the whole degree`, () => {
		const malaga = byName(cities, "Málaga");
		expect(areaPoint(cities, malaga, "country")).toEqual({ lat: 38, lng: -2 });
		expect(areaPoint(cities, { country: "FR" }, "country")).toBeNull();
	});

	it("rounds a dragged pin to about a kilometre", () => {
		expect(roundPoint({ lat: -6.917_464, lng: 107.619_123 })).toEqual({ lat: -6.92, lng: 107.62 });
		expect(roundPoint({ lat: 95, lng: -200 })).toEqual({ lat: 90, lng: -180 });
	});
});

describe("the bundled city list", () => {
	const list = parseCities(readFileSync(new URL("./cities.txt", import.meta.url), "utf8"));

	it("holds the GeoNames cities with time zones", () => {
		expect(list.length).toBeGreaterThan(30_000);
		expect(findCity(list, "Bandung, Indonesia", english)).toMatchObject({
			country: "ID",
			region: "West Java",
			timezone: "Asia/Jakarta",
		});
		expect(searchCities(list, "Valencia", english).map((city) => city.country)).toEqual(
			expect.arrayContaining(["ES", "VE"]),
		);
	});

	it("never centres a province on a town of its own, whatever its size", () => {
		const key = (city: City) => `${city.country}|${city.region}`;
		const sizes = new Map<string, number>();
		for (const city of list) sizes.set(key(city), (sizes.get(key(city)) ?? 0) + 1);
		const small = list.filter((city) => (sizes.get(key(city)) ?? 0) < MIN_AREA_CITIES);
		// Hundreds of provinces have a single listed town (Lima Province, Banaadir…).
		expect(small.length).toBeGreaterThan(700);
		for (const city of small) {
			const centre = areaCenter(list, city, "region");
			expect(centre, `${city.name}, ${city.region}`).toEqual(areaCenter(list, city, "country"));
			expect(centre, `${city.name}, ${city.region}`).not.toEqual({ lat: city.lat, lng: city.lng });
		}
	});

	it("searches the whole list fast enough to run on every key press", () => {
		searchCities(list, "warm-up", english);
		const started = performance.now();
		for (const query of ["b", "ba", "ban", "band", "bandung", "sao paulo", "zzz"])
			searchCities(list, query, english, 6);
		expect(performance.now() - started).toBeLessThan(150);
	});
});
