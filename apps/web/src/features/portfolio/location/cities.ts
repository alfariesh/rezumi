import type { PORTFOLIO_MAP_PRECISIONS } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";

type Precision = (typeof PORTFOLIO_MAP_PRECISIONS)[number];

/** A city from the bundled GeoNames list (`tooling/portfolio/cities.ts`). */
export type City = {
	name: string;
	/** The name in plain ASCII, for searching without accents ("Malmo" finds "Malmö"). */
	ascii: string;
	/** ISO 3166-1 alpha-2. */
	country: string;
	/** The first-level region in English ("West Java"), or empty. */
	region: string;
	lat: number;
	lng: number;
	timezone: string;
};

/** A province or state (`region`), or a whole country (`region` left out). */
export type Area = Pick<City, "country"> & { region?: string };

/** A country's name in a language, such as Intl.DisplayNames gives. */
export type CountryName = (code: string) => string;

/**
 * An area with fewer listed cities than this isn't centred on their middle: with one or two, the middle is a town's
 * own point. A province is then centred on its country, and a country (a small island state) to the whole degree.
 */
export const MIN_AREA_CITIES = 5;

/** Reads the city list's text: two header lines (time zones, regions), then one tab-separated line per city. */
export function parseCities(text: string): City[] {
	let zones: string[] = [];
	let regions: string[] = [];
	const cities: City[] = [];
	for (const line of text.split("\n")) {
		if (!line) continue;
		if (line.startsWith("#zones\t")) zones = line.split("\t").slice(1);
		else if (line.startsWith("#regions\t")) regions = line.split("\t").slice(1);
		else if (!line.startsWith("#")) {
			const [name = "", ascii = "", country = "", region = "", lat = "", lng = "", zone = ""] = line.split("\t");
			const timezone = zones[Number(zone)];
			if (!name || !country || !timezone) continue;
			cities.push({
				name,
				ascii: ascii || name,
				country,
				region: regions[Number(region)] ?? "",
				lat: Number(lat),
				lng: Number(lng),
				timezone,
			});
		}
	}
	return cities;
}

/** Lowercase without accents or punctuation, so "São Paulo", "sao paulo" and "Sao-Paulo" compare equal. */
export function normalizePlace(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

/** Whether text has letters, none of them Latin: a name the list (Latin names only) can't hold. */
export function hasOnlyOtherScripts(text: string): boolean {
	return /\p{L}/u.test(text) && !/\p{Script=Latin}/u.test(text);
}

// Searching normalises each city's names once per list, not once per keystroke (~68,000 strings).
const searchNames = new WeakMap<readonly City[], readonly (readonly [string, string])[]>();

function namesOf(cities: readonly City[]): readonly (readonly [string, string])[] {
	let names = searchNames.get(cities);
	if (!names) {
		names = cities.map((city) => [normalizePlace(city.name), normalizePlace(city.ascii)] as const);
		searchNames.set(cities, names);
	}
	return names;
}

const asList = (names: CountryName | readonly CountryName[]): readonly CountryName[] =>
	typeof names === "function" ? [names] : names;

function matchesArea(city: City, area: string, countryNames: readonly CountryName[]): boolean {
	if (!area) return true;
	const names = [city.region, city.country, ...countryNames.map((name) => name(city.country))].map(normalizePlace);
	return names.some((name) => name.startsWith(area) || name.split(" ").some((word) => word.startsWith(area)));
}

/**
 * Cities matching what someone typed, largest first: names that start with it, then names with a word that does.
 * "Bandung, Indonesia" or "Valencia, Spain" narrows by region or country after the comma, in any of the languages
 * `countryNames` gives.
 */
export function searchCities(
	cities: readonly City[],
	query: string,
	countryNames: CountryName | readonly CountryName[],
	limit = 8,
): City[] {
	const [place = "", ...rest] = query.split(",");
	const term = normalizePlace(place);
	const area = normalizePlace(rest.join(" "));
	if (!term) return [];
	const languages = asList(countryNames);
	const names = namesOf(cities);
	const starts: City[] = [];
	const words: City[] = [];
	for (const [index, city] of cities.entries()) {
		const own = names[index] ?? [];
		const start = own.some((name) => name.startsWith(term));
		const word = !start && own.some((name) => name.split(" ").some((part) => part.startsWith(term)));
		if (!(start || word) || !matchesArea(city, area, languages)) continue;
		if (start) starts.push(city);
		else words.push(city);
		if (starts.length >= limit) break;
	}
	return [...starts, ...words].slice(0, limit);
}

/**
 * The city a resume's location names ("Bandung, Indonesia", "Jakarta"), for the form's first value: an exact name,
 * narrowed by what follows the comma, the largest when several share it. Null when nothing matches exactly.
 */
export function findCity(
	cities: readonly City[],
	location: string,
	countryNames: CountryName | readonly CountryName[],
): City | null {
	const [place = "", ...rest] = location.split(",");
	const term = normalizePlace(place);
	if (!term) return null;
	const area = normalizePlace(rest.join(" "));
	const names = namesOf(cities);
	const named = cities.filter((_, index) => names[index]?.includes(term));
	const languages = asList(countryNames);
	return named.find((city) => matchesArea(city, area, languages)) ?? named[0] ?? null;
}

/** The label an area shows at a precision: "West Java, Indonesia" for a province, "Indonesia" for a country. */
export function areaLabel(area: Area, precision: Exclude<Precision, "city">, countryName: CountryName): string {
	const country = countryName(area.country) || area.country;
	const parts =
		precision === "region" && area.region && normalizePlace(area.region) !== normalizePlace(country)
			? [area.region, country]
			: [country];
	return parts.join(", ").slice(0, PORTFOLIO_LIMITS.text.location);
}

/** The label a location shows at a precision: "Bandung, Indonesia", "West Java, Indonesia" or "Indonesia". */
export function cityLabel(city: City, precision: Precision, countryName: CountryName): string {
	if (precision !== "city") return areaLabel(city, precision, countryName);
	const country = countryName(city.country) || city.country;
	return [city.name, country].join(", ").slice(0, PORTFOLIO_LIMITS.text.location);
}

type AreaSums = { count: number; lat: number; lng: number };
type AreaIndex = { regions: Map<string, AreaSums>; countries: Map<string, AreaSums> };

const areaIndexes = new WeakMap<readonly City[], AreaIndex>();

const regionKey = (area: Area) => `${area.country}\t${area.region ?? ""}`;

/** Every province's and country's listed cities, summed once per list. */
function areaIndex(cities: readonly City[]): AreaIndex {
	let index = areaIndexes.get(cities);
	if (!index) {
		const add = (map: Map<string, AreaSums>, key: string, city: City) => {
			const sums = map.get(key) ?? { count: 0, lat: 0, lng: 0 };
			map.set(key, { count: sums.count + 1, lat: sums.lat + city.lat, lng: sums.lng + city.lng });
		};
		index = { regions: new Map(), countries: new Map() };
		for (const city of cities) {
			add(index.regions, regionKey(city), city);
			add(index.countries, city.country, city);
		}
		areaIndexes.set(cities, index);
	}
	return index;
}

/**
 * Where a map of an area centres: the middle of its listed cities, so it doesn't give away any one of them. A province
 * with fewer than `MIN_AREA_CITIES` listed cities is centred on its country instead (with one, its middle would be that
 * town), and a country with that few is centred to the whole degree. Null for a country not in the list.
 */
export function areaPoint(
	cities: readonly City[],
	area: Area,
	precision: Exclude<Precision, "city">,
): { lat: number; lng: number } | null {
	const { regions, countries } = areaIndex(cities);
	const region = precision === "region" && area.region ? regions.get(regionKey(area)) : undefined;
	const sums = region && region.count >= MIN_AREA_CITIES ? region : countries.get(area.country);
	if (!sums) return null;
	const step = sums.count >= MIN_AREA_CITIES ? 100 : 1;
	const round = (value: number) => Math.round((value / sums.count) * step) / step;
	return { lat: round(sums.lat), lng: round(sums.lng) };
}

/** Where the map centres for a chosen city at a precision: the city's own point only at city precision. */
export function areaCenter(cities: readonly City[], city: City, precision: Precision): { lat: number; lng: number } {
	if (precision === "city") return { lat: city.lat, lng: city.lng };
	return areaPoint(cities, city, precision) ?? { lat: Math.round(city.lat), lng: Math.round(city.lng) };
}

/** Every area listed: each country, and each province of one, for finding an area by its centre. */
export function listedAreas(cities: readonly City[]): Area[] {
	const { regions, countries } = areaIndex(cities);
	return [
		...[...countries.keys()].map((country) => ({ country })),
		...[...regions.keys()].flatMap((key) => {
			const [country = "", region = ""] = key.split("\t");
			return region ? [{ country, region }] : [];
		}),
	];
}

/**
 * A point someone dragged the pin to, rounded to about a kilometre (two decimals): enough for a neighbourhood, never
 * a street address.
 */
export function roundPoint(point: { lat: number; lng: number }): { lat: number; lng: number } {
	const round = (value: number, limit: number) => Math.max(-limit, Math.min(limit, Math.round(value * 100) / 100));
	return { lat: round(point.lat, 90), lng: round(point.lng, 180) };
}

/** Country names in a language; codes the browser doesn't know stay as they are. */
export function countryNames(locale: string): CountryName {
	let names: Intl.DisplayNames | null = null;
	try {
		names = new Intl.DisplayNames([locale, "en"], { type: "region" });
	} catch {
		names = null;
	}
	return (code) => {
		try {
			return names?.of(code) ?? code;
		} catch {
			return code;
		}
	};
}
