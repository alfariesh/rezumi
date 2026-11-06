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

/** A country's name in a language, such as Intl.DisplayNames gives. */
export type CountryName = (code: string) => string;

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

function matchesArea(city: City, area: string, countryName: CountryName): boolean {
	if (!area) return true;
	const names = [city.region, city.country, countryName(city.country)].map(normalizePlace);
	return names.some((name) => name.startsWith(area) || name.split(" ").some((word) => word.startsWith(area)));
}

/**
 * Cities matching what someone typed, largest first: names that start with it, then names with a word that does.
 * "Bandung, Indonesia" or "Valencia, Spain" narrows by region or country after the comma.
 */
export function searchCities(cities: readonly City[], query: string, countryName: CountryName, limit = 8): City[] {
	const [place = "", ...rest] = query.split(",");
	const term = normalizePlace(place);
	const area = normalizePlace(rest.join(" "));
	if (!term) return [];
	const starts: City[] = [];
	const words: City[] = [];
	for (const city of cities) {
		const names = [normalizePlace(city.name), normalizePlace(city.ascii)];
		const start = names.some((name) => name.startsWith(term));
		const word = !start && names.some((name) => name.split(" ").some((part) => part.startsWith(term)));
		if (!(start || word) || !matchesArea(city, area, countryName)) continue;
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
export function findCity(cities: readonly City[], location: string, countryName: CountryName): City | null {
	const [place = "", ...rest] = location.split(",");
	const term = normalizePlace(place);
	if (!term) return null;
	const area = normalizePlace(rest.join(" "));
	const named = cities.filter((city) => normalizePlace(city.name) === term || normalizePlace(city.ascii) === term);
	return named.find((city) => matchesArea(city, area, countryName)) ?? named[0] ?? null;
}

/** The label a location shows at a precision: "Bandung, Indonesia", "West Java, Indonesia" or "Indonesia". */
export function cityLabel(city: City, precision: Precision, countryName: CountryName): string {
	const country = countryName(city.country) || city.country;
	const parts =
		precision === "city"
			? [city.name, country]
			: precision === "region" && city.region && normalizePlace(city.region) !== normalizePlace(country)
				? [city.region, country]
				: [country];
	return parts.join(", ").slice(0, PORTFOLIO_LIMITS.text.location);
}

/**
 * Where the map centres at a precision. A city's own point only at city precision; a region or country is centred
 * on the middle of its listed cities, so a broader map doesn't give away the city.
 */
export function areaCenter(cities: readonly City[], city: City, precision: Precision): { lat: number; lng: number } {
	if (precision === "city") return { lat: city.lat, lng: city.lng };
	const area = cities.filter(
		(entry) => entry.country === city.country && (precision === "country" || entry.region === city.region),
	);
	if (!area.length) return { lat: city.lat, lng: city.lng };
	const round = (value: number) => Math.round(value * 100) / 100;
	return {
		lat: round(area.reduce((sum, entry) => sum + entry.lat, 0) / area.length),
		lng: round(area.reduce((sum, entry) => sum + entry.lng, 0) / area.length),
	};
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
