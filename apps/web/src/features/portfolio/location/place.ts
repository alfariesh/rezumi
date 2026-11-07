import type { Area, City, CountryName } from "./cities";
import type { MapPrecision } from "./map-config";
import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import { create } from "zustand/react";
import { areaCenter, areaLabel, areaPoint, cityLabel, listedAreas, normalizePlace } from "./cities";

type Point = { lat: number; lng: number };

const PRECISION_ORDER: Record<MapPrecision, number> = { city: 0, region: 1, country: 2 };

/** How far (in degrees) a dragged pin may sit from its city and still count as that city: "around your city". */
const DRAGGED_PIN_RANGE = 0.5;

const samePoint = (a: Point, b: Point) => a.lat === b.lat && a.lng === b.lng;

/**
 * What the editor knows of the place a location shows: the city when it's known, else its province or only its
 * country. Saved data holds only the point and the label; the city is known from the list when the point is a
 * city's own (or one picked in this visit), a province or country when the point is that area's centre.
 */
export type KnownPlace = { country: string; region?: string; city?: City };

/** Whether a city picked earlier is still the place `point` shows: its point (or a pin dragged around it), or the
 * centre of its province or country at those precisions. */
export function isPlaceOf(cities: readonly City[], city: City, point: Point & { precision: MapPrecision }): boolean {
	if (point.precision === "city")
		return Math.abs(point.lat - city.lat) <= DRAGGED_PIN_RANGE && Math.abs(point.lng - city.lng) <= DRAGGED_PIN_RANGE;
	return samePoint(point, areaCenter(cities, city, point.precision));
}

/**
 * The place a location shows, from what's saved, never from a guess: `chosen` (the city picked in this visit) while it
 * still fits the point; a listed city whose own point it is (the label's city first, when several share it); or, at
 * province and country precision, the area whose centre it is. Null when it can't be told (a pin dragged after a
 * reload, a list that changed since): a finer precision then needs the city picked again.
 */
export function identifyPlace(
	cities: readonly City[],
	location: Pick<PortfolioLocation, "point" | "label">,
	chosen: City | null,
): KnownPlace | null {
	const { point } = location;
	if (!point) return null;
	if (chosen && isPlaceOf(cities, chosen, point))
		return { country: chosen.country, region: chosen.region, city: chosen };

	if (point.precision === "city") {
		// A city's own point; for a pin dragged around a city, the city the label still names.
		const named = normalizePlace(location.label.split(",")[0] ?? "");
		const isNamed = (city: City) => normalizePlace(city.name) === named || normalizePlace(city.ascii) === named;
		const here = cities.filter((city) => samePoint(city, point));
		const city =
			here.find(isNamed) ?? here[0] ?? cities.find((entry) => isNamed(entry) && isPlaceOf(cities, entry, point));
		return city ? { country: city.country, region: city.region, city } : null;
	}

	const precision = point.precision;
	const areas = listedAreas(cities).filter(
		(area) =>
			(precision === "country" ? area.region === undefined : area.region !== undefined) &&
			samePoint(areaPoint(cities, area, precision) ?? { lat: Number.NaN, lng: Number.NaN }, point),
	);
	const countries = new Set(areas.map((area) => area.country));
	const [area] = areas;
	if (countries.size !== 1 || !area) return null;
	// Small provinces share their country's centre: the country is known, the province only when it's the one.
	return areas.length === 1 && area.region !== undefined
		? { country: area.country, region: area.region }
		: { country: area.country };
}

export type PlaceChange = { point: Point & { precision: MapPrecision }; label: string };

/**
 * The point and label a location takes at another precision, from what's known of its place, or null when that isn't
 * enough (a finer precision than what's known): the city must be picked again. The time zone never changes here; only
 * picking a city sets it.
 */
export function placeAtPrecision(
	cities: readonly City[],
	place: KnownPlace | null,
	precision: MapPrecision,
	countryName: CountryName,
): PlaceChange | null {
	if (!place) return null;
	if (place.city) {
		const { city } = place;
		return {
			point: { ...areaCenter(cities, city, precision), precision },
			label: cityLabel(city, precision, countryName),
		};
	}
	if (precision === "city" || (precision === "region" && place.region === undefined)) return null;
	const area: Area = precision === "region" ? place : { country: place.country };
	const point = areaPoint(cities, area, precision);
	return point ? { point: { ...point, precision }, label: areaLabel(area, precision, countryName) } : null;
}

/** Whether `next` shows less than `current` (city → province → country). */
export function isCoarser(next: MapPrecision, current: MapPrecision): boolean {
	return PRECISION_ORDER[next] > PRECISION_ORDER[current];
}

type ChosenCity = {
	/** The city last picked from the list in this visit; it stays known while the form is closed and opened again. */
	city: City | null;
	choose: (city: City | null) => void;
};

/**
 * The city picked in the location form, kept outside the portfolio's data (its schema holds no city), so changing the
 * precision back and forth in one visit returns to that city.
 */
export const useChosenCity = create<ChosenCity>()((set) => ({
	city: null,
	choose: (city) => set({ city }),
}));
