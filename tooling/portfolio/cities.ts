/**
 * Builds the city list the portfolio editor searches for its location card (`02-teknis.md` section 24) from GeoNames
 * (https://www.geonames.org, CC BY 4.0). Download `cities15000.zip` and `admin1CodesASCII.txt` from
 * https://download.geonames.org/export/dump/, unzip the first, then run:
 *
 *   pnpm --filter @rezumi/tooling portfolio:cities <folder with cities15000.txt and admin1CodesASCII.txt>
 *
 * The output is a small text file, loaded only when someone opens the location form: two header lines (time zones,
 * regions) and one line per city (name, ASCII name when different, country code, region, latitude, longitude, time
 * zone), largest first, so search results come in population order.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const folder = process.argv[2];
if (!folder) throw new Error("Pass the folder holding cities15000.txt and admin1CodesASCII.txt.");

const output = new URL("../../apps/web/src/features/portfolio/location/cities.txt", import.meta.url);
const clean = (text: string) => text.replace(/[\t\n\r]/g, " ").trim();

const regions = new Map<string, string>();
for (const line of (await readFile(join(folder, "admin1CodesASCII.txt"), "utf8")).split("\n")) {
	const [code, name] = line.split("\t");
	if (code && name) regions.set(code, clean(name));
}

type City = {
	name: string;
	ascii: string;
	country: string;
	region: string;
	lat: number;
	lng: number;
	zone: string;
	population: number;
};
const cities: City[] = [];
for (const line of (await readFile(join(folder, "cities15000.txt"), "utf8")).split("\n")) {
	const field = line.split("\t");
	if (field.length < 18) continue;
	const [
		,
		name = "",
		ascii = "",
		,
		lat = "",
		lng = "",
		,
		,
		country = "",
		,
		admin1 = "",
		,
		,
		,
		population = "",
		,
		,
		zone = "",
	] = field;
	if (!name || !country || !zone) continue;
	cities.push({
		name: clean(name),
		ascii: clean(ascii),
		country,
		region: regions.get(`${country}.${admin1}`) ?? "",
		lat: Number(lat),
		lng: Number(lng),
		zone,
		population: Number(population) || 0,
	});
}
cities.sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));

const zones = [...new Set(cities.map((city) => city.zone))];
const regionNames = [...new Set(cities.map((city) => city.region))];
const zoneIndex = new Map(zones.map((zone, index) => [zone, index]));
const regionIndex = new Map(regionNames.map((region, index) => [region, index]));

const rows = cities.map((city) =>
	[
		city.name,
		city.ascii === city.name ? "" : city.ascii,
		city.country,
		regionIndex.get(city.region),
		city.lat.toFixed(2).replace(/\.?0+$/, ""),
		city.lng.toFixed(2).replace(/\.?0+$/, ""),
		zoneIndex.get(city.zone),
	].join("\t"),
);

await writeFile(
	output,
	[
		"# GeoNames cities15000 (https://www.geonames.org), CC BY 4.0. Built by tooling/portfolio/cities.ts.",
		["#zones", ...zones].join("\t"),
		["#regions", ...regionNames].join("\t"),
		...rows,
	].join("\n") + "\n",
);
console.log(`Wrote ${cities.length} cities, ${zones.length} time zones, ${regionNames.length} regions.`);
