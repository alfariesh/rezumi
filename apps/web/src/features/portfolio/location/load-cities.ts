import type { City } from "./cities";
import { parseCities } from "./cities";
import citiesUrl from "./cities.txt?url";

let loading: Promise<City[]> | null = null;

/**
 * The bundled GeoNames city list (about 420 KB compressed), fetched the first time the location form needs it and kept
 * for the session. A failed load can be tried again.
 */
export function loadCities(): Promise<City[]> {
	loading ??= fetch(citiesUrl)
		.then((response) => {
			if (!response.ok) throw new Error(`The city list didn't load (${response.status}).`);
			return response.text();
		})
		.then(parseCities)
		.catch((error: unknown) => {
			loading = null;
			throw error;
		});
	return loading;
}
