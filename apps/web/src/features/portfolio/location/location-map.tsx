import type { MapPrecision } from "./map-config";
import { Map } from "@heroui-pro/react/map";
import { t } from "@lingui/core/macro";
import { roundPoint } from "./cities";
import { MAP_STYLES, MAP_WORKER_URL, mapZoom } from "./map-config";
import "maplibre-gl/dist/maplibre-gl.css";

type LocationMapProps = {
	point: { lat: number; lng: number };
	precision: MapPrecision;
	label: string;
	/** Called with the new point, rounded to about a kilometre, after the pin is dragged. */
	onMove: (point: { lat: number; lng: number }) => void;
};

/**
 * The editor's location map (HeroUI Pro `Map` on MapLibre with OpenFreeMap styles), loaded only in the location form.
 * The view follows the point and precision; at city precision the pin can be dragged. Never on the public page.
 */
export default function LocationMap({ point, precision, label, onMove }: LocationMapProps) {
	const place = label;
	return (
		<div className="relative aspect-5/3 w-full overflow-hidden rounded-xl border border-border">
			<Map
				aria-label={place ? t`Map around ${place}` : t`Map`}
				className="size-full"
				styles={MAP_STYLES}
				workerUrl={MAP_WORKER_URL}
				viewport={{ center: [point.lng, point.lat], zoom: mapZoom(precision) }}
				dragRotate={false}
				pitchWithRotate={false}
				touchPitch={false}
			>
				{precision === "city" && (
					<Map.Marker
						latitude={point.lat}
						longitude={point.lng}
						draggable
						onDragEnd={(next) => onMove(roundPoint(next))}
					>
						<Map.MarkerContent>
							<Map.MarkerDot />
						</Map.MarkerContent>
					</Map.Marker>
				)}
				<Map.Controls position="top-right">
					<Map.ZoomControl />
				</Map.Controls>
			</Map>
		</div>
	);
}
