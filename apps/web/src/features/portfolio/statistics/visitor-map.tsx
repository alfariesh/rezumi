import { Map } from "@heroui-pro/react/map";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { countryNames } from "../location/cities";
import { loadCities } from "../location/load-cities";
import { MAP_STYLES, MAP_WORKER_URL } from "../location/map-config";
import { countryCenters } from "./country-centers";
import "maplibre-gl/dist/maplibre-gl.css";

type VisitorMapProps = { countries: readonly { code: string; views: number }[] };

/** Dot sizes: the area follows the visits, and the smallest stays easy to see and to point at. */
const MIN_DOT = 12;
const MAX_DOT = 36;

/**
 * Visitors' countries (HeroUI Pro `Map`, `01-desain.md` section 19): one dot per country at the middle of its listed
 * cities, the bundled city list giving the positions so no extra data is shipped. Loaded only for the plan that has it.
 */
export default function VisitorMap({ countries }: VisitorMapProps) {
	const { i18n } = useLingui();
	const { data: cities } = useQuery({ queryKey: ["portfolio", "cities"], queryFn: loadCities, staleTime: Infinity });
	const centers = useMemo(() => (cities ? countryCenters(cities) : null), [cities]);
	const country = countryNames(i18n.locale);
	const peak = Math.max(1, ...countries.map((row) => row.views));

	return (
		<div className="relative aspect-5/2 w-full overflow-hidden rounded-xl border border-border max-sm:aspect-4/3">
			<Map
				aria-label={t`Map of visitors' countries`}
				className="size-full"
				styles={MAP_STYLES}
				workerUrl={MAP_WORKER_URL}
				viewport={{ center: [20, 15], zoom: 0.9 }}
				dragRotate={false}
				pitchWithRotate={false}
				touchPitch={false}
			>
				{countries.flatMap((row) => {
					const center = centers?.get(row.code);
					if (!center) return [];
					const size = Math.round(MIN_DOT + (MAX_DOT - MIN_DOT) * Math.sqrt(row.views / peak));
					return [
						<Map.Marker key={row.code} latitude={center.lat} longitude={center.lng}>
							<Map.MarkerContent>
								<span
									className="block rounded-full bg-accent/70 ring-2 ring-surface"
									style={{ width: size, height: size }}
								/>
							</Map.MarkerContent>
							<Map.MarkerTooltip>
								{country(row.code)}: {row.views.toLocaleString(i18n.locale)}
							</Map.MarkerTooltip>
						</Map.Marker>,
					];
				})}
				<Map.Controls position="top-right">
					<Map.ZoomControl />
				</Map.Controls>
			</Map>
		</div>
	);
}
