import type { City } from "../location/cities";

/** The middle of each country's listed cities, by ISO code: where its dot goes on the visitors' map. */
export function countryCenters(cities: readonly City[]): Map<string, { lat: number; lng: number }> {
	const totals = new Map<string, { lat: number; lng: number; count: number }>();
	for (const city of cities) {
		const total = totals.get(city.country) ?? { lat: 0, lng: 0, count: 0 };
		total.lat += city.lat;
		total.lng += city.lng;
		total.count += 1;
		totals.set(city.country, total);
	}
	return new Map(
		[...totals].map(([code, total]) => [code, { lat: total.lat / total.count, lng: total.lng / total.count }]),
	);
}
