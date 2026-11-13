import type { City } from "./cities";
import type { MapPrecision } from "./map-config";
import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import { Alert, Button, Spinner } from "@heroui/react";
import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { PORTFOLIO_WORK_MODES } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { ChunkBoundary, retryableLazy } from "../editor/chunk-boundary";
import { pageLocaleOf, usePortfolioSource } from "../editor/context";
import { ChoiceSelect, TextInput } from "../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { areaCenter, cityLabel, countryNames, findCity, hasOnlyOtherScripts, searchCities } from "./cities";
import { loadCities } from "./load-cities";
import {
	mapPictureNeeded,
	mapPictures,
	mapPictureSignature,
	setLocationPoint,
	useMapPictureStatus,
} from "./map-pictures";
import { identifyPlace, placeAtPrecision, useChosenCity } from "./place";

const locationMap = retryableLazy(() => import("./location-map"));

const { text: max } = PORTFOLIO_LIMITS;

const workModeLabel = (mode: PortfolioLocation["workModes"][number]) =>
	({ remote: t`Remote`, hybrid: t`Hybrid`, onsite: t`On-site` })[mode];

const precisionLabel = (precision: MapPrecision) =>
	({ city: t`City`, region: t`Province or state`, country: t`Country` })[precision];

/** Common time zones; picking a city sets its own. */
function timeZoneOptions(current: string | undefined) {
	const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const zones = [
		"Asia/Jakarta",
		"Asia/Makassar",
		"Asia/Jayapura",
		"Asia/Singapore",
		"Asia/Kuala_Lumpur",
		"Asia/Tokyo",
		"Asia/Dubai",
		"Europe/London",
		"Europe/Amsterdam",
		"America/New_York",
		"America/Los_Angeles",
		"Australia/Sydney",
		"UTC",
	];
	const all = [...new Set([...(current ? [current] : []), device, ...zones].filter(Boolean))];
	return all.map((zone) => ({ id: zone, label: zone.replaceAll("_", " ") }));
}

/** The city list, loaded when the form first needs it. */
function useCities() {
	const [cities, setCities] = useState<City[] | null>(null);
	const [failed, setFailed] = useState(false);
	const load = async () => {
		if (cities) return cities;
		try {
			setFailed(false);
			const list = await loadCities();
			setCities(list);
			return list;
		} catch {
			setFailed(true);
			return null;
		}
	};
	return { cities, failed, load };
}

type MapPictureState = "idle" | "working" | "saved" | "failed";

/** What the map picture of the location shown is doing, from the data and the picture maker. */
function useMapPictureState(location: PortfolioLocation): MapPictureState {
	const signature = mapPictureSignature(location);
	const status = useMapPictureStatus();
	if (!signature) return "idle";
	if (location.map) return "saved";
	if (status.working === signature) return "working";
	if (mapPictureNeeded(location) && status.failed.includes(signature)) return "failed";
	return "working";
}

/**
 * The Location card's form (`01-desain.md` section 19): pick a city from the bundled list (first suggestion from the
 * resume's location), choose how precise to be, and optionally show a map. Privacy first: the map is off by default,
 * the pin sits at the city's centre, and there's no "use my location". The map's pictures are made by `mapPictures`,
 * which follows the data, so they arrive even after this form closes.
 */
export function LocationFields() {
	const data = usePortfolioData();
	const { location } = data;
	const source = usePortfolioSource();
	const resumeLocation = source.data?.basics.location ?? "";
	const pageLocale = pageLocaleOf(data, source.designData);
	const appLocale = i18n.locale;
	const names = useMemo(() => countryNames(pageLocale), [pageLocale]);
	const appNames = useMemo(() => countryNames(appLocale), [appLocale]);
	// Countries after a comma may be typed in the app's language, the page's, or English.
	const areaNames = useMemo(() => [appNames, names, countryNames("en")], [appNames, names]);
	const { cities, failed, load } = useCities();
	const [query, setQuery] = useState("");
	const search = useDeferredValue(query);
	const [searching, setSearching] = useState(false);
	/** A finer precision asked for when the city isn't known: picking the city again applies it. */
	const [wanted, setWanted] = useState<MapPrecision | null>(null);
	const picture = useMapPictureState(location);
	const precision = location.point?.precision ?? "city";
	const hasPoint = Boolean(location.point);

	// From here on, map pictures follow the data for the rest of the visit, also once this form closes.
	useEffect(() => {
		mapPictures.watch();
	}, []);

	// Without a city yet, the list loads at once so the resume's location can be offered.
	useEffect(() => {
		if (!hasPoint) void load();
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- `load` is remade each render; loading once is enough.
	}, [hasPoint]);

	const results = useMemo(
		() => (cities && searching ? searchCities(cities, search, areaNames, 6) : []),
		[cities, searching, search, areaNames],
	);
	const suggestion = useMemo(
		() =>
			cities && !location.point && !search.trim()
				? findCity(cities, location.label || resumeLocation, areaNames)
				: null,
		[cities, location.point, location.label, resumeLocation, search, areaNames],
	);

	const place = (city: City, nextPrecision: MapPrecision) => {
		const list = cities ?? [];
		useChosenCity.getState().choose(city);
		setQuery("");
		setSearching(false);
		setWanted(null);
		editPortfolio((draft) => {
			setLocationPoint(
				draft.location,
				{ ...areaCenter(list, city, nextPrecision), precision: nextPrecision },
				cityLabel(city, nextPrecision, names),
			);
			// Picking a city is the only time its time zone is taken; a precision change keeps the zone.
			draft.location.timezone = city.timezone;
		});
	};

	const changePrecision = async (next: MapPrecision) => {
		const list = await load();
		const current = usePortfolioEditorStore.getState().portfolio?.data.location;
		if (!list || !current?.point || current.point.precision === next) return;
		const change = placeAtPrecision(list, identifyPlace(list, current, useChosenCity.getState().city), next, names);
		if (!change) {
			// The saved place doesn't say which city it was: it's picked again, never guessed.
			setWanted(next);
			return;
		}
		setWanted(null);
		editPortfolio((draft) => setLocationPoint(draft.location, change.point, change.label));
	};

	const clearPlace = () => {
		useChosenCity.getState().choose(null);
		setWanted(null);
		editPortfolio(
			(draft) => {
				delete draft.location.point;
				delete draft.location.map;
				draft.location.showMap = false;
			},
			{ structural: true },
		);
	};

	const noResults = searching && search.trim() !== "" && cities !== null && results.length === 0;
	const listed = searching && search.trim() !== "" && cities !== null;

	return (
		<div className="grid gap-4">
			<span className="text-sm font-medium">
				<Trans>Location card</Trans>
			</span>

			{/* Escape puts the list of cities away, as in any search. */}
			<div
				role="search"
				className="grid gap-2"
				onKeyDown={(event) => {
					if (event.key === "Escape" && searching) {
						event.stopPropagation();
						setSearching(false);
					}
				}}
			>
				<TextInput
					label={location.point ? t`Change the city` : t`Find your city`}
					icon="magnifying-glass"
					value={query}
					maxLength={80}
					placeholder={t`Type a city, such as Bandung`}
					onChange={(value) => {
						setQuery(value);
						setSearching(true);
						void load();
					}}
				/>
				{failed && (
					<p className="text-body-xs text-danger">
						<Trans>The city list didn't load. Check your connection, then type again.</Trans>
					</p>
				)}
				{/* Screen readers hear how many cities match as the person types. */}
				<span role="status" className="sr-only">
					{listed ? plural(results.length, { 0: "No cities found", one: "# city found", other: "# cities found" }) : ""}
				</span>
				{listed && (
					<ul className="grid gap-1" aria-label={t`Cities`}>
						{results.map((result) => (
							<li key={`${result.name}-${result.country}-${result.lat}-${result.lng}`}>
								<Button
									variant="ghost"
									className="h-auto w-full justify-start py-1.5 text-start"
									onPress={() => place(result, wanted ?? precision)}
								>
									<Icon name="map-pin" size={16} className="text-muted" />
									<span className="grid">
										<span className="text-sm font-medium">{result.name}</span>
										<span className="text-xs text-muted">
											{[result.region, appNames(result.country)].filter(Boolean).join(", ")}
										</span>
									</span>
								</Button>
							</li>
						))}
						{noResults && (
							<li className="px-2 text-xs text-muted">
								{hasOnlyOtherScripts(search.split(",")[0] ?? "") ? (
									<Trans>Cities are listed by their names in Latin letters. Type it that way, such as “Tokyo”.</Trans>
								) : (
									<Trans>
										No city by that name. Larger towns are listed; type the nearest one, then edit the label.
									</Trans>
								)}
							</li>
						)}
					</ul>
				)}
				{suggestion && (
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="text-muted">
							{source.from === "profile" ? <Trans>From your Profile:</Trans> : <Trans>From your resume:</Trans>}{" "}
							<b className="text-foreground">
								{suggestion.name}, {appNames(suggestion.country)}
							</b>
						</span>
						<Button size="sm" variant="secondary" onPress={() => place(suggestion, "city")}>
							<Trans>Use this city</Trans>
						</Button>
					</div>
				)}
				<p className="text-body-xs text-muted">
					<Trans>
						City list from{" "}
						<a className="underline" href="https://www.geonames.org" target="_blank" rel="noreferrer">
							GeoNames
						</a>{" "}
						(CC BY 4.0). There's no "use my location": you choose the place you show.
					</Trans>
				</p>
			</div>

			<TextInput
				label={t`City or region on the page`}
				value={location.label}
				maxLength={max.location}
				icon="map-pin"
				placeholder={resumeLocation || t`Bandung, Indonesia`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							draft.location.label = value;
						},
						{ key: "location.label" },
					)
				}
			/>

			{location.point && (
				<ChoiceSelect
					label={t`How precise`}
					value={precision}
					options={(["city", "region", "country"] as const).map((option) => ({
						id: option,
						label: precisionLabel(option),
					}))}
					onChange={(value) => void changePrecision(value)}
				/>
			)}
			{wanted && wanted !== precision && location.point && (
				<p className="text-body-xs text-warning" role="status">
					{wanted === "city" ? (
						<Trans>To show your city, find it again above. The page keeps what it shows until then.</Trans>
					) : (
						<Trans>
							To show your province or state, find your city again above. The page keeps what it shows until then.
						</Trans>
					)}
				</p>
			)}

			<CellSwitchRow
				isSelected={location.showMap}
				isDisabled={!location.point}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.showMap = checked;
						// Pictures are made for the map that's turned on, never kept from an earlier one.
						delete draft.location.map;
					})
				}
				label={t`Show a map on my page`}
			/>

			{location.showMap && location.point && (
				<div className="grid gap-2">
					<ChunkBoundary>
						{(attempt) => {
							const LocationMap = locationMap(attempt);
							const shown = location.point;
							if (!shown) return null;
							return (
								<Suspense
									fallback={
										<div className="grid aspect-5/3 place-items-center rounded-xl border border-separator">
											<Spinner size="sm" />
										</div>
									}
								>
									<LocationMap
										point={shown}
										precision={precision}
										label={location.label}
										onMove={(point) =>
											editPortfolio((draft) => {
												const current = draft.location.point;
												if (current) setLocationPoint(draft.location, { ...point, precision: current.precision });
											})
										}
									/>
								</Suspense>
							);
						}}
					</ChunkBoundary>
					{precision === "city" && (
						<Alert status="warning">
							<Alert.Indicator>
								<Icon name="warning" />
							</Alert.Indicator>
							<Alert.Content>
								<Alert.Description>
									<Trans>
										Don't put the pin on your home address. You can drag it around your city; it's rounded to about a
										kilometre.
									</Trans>
								</Alert.Description>
							</Alert.Content>
						</Alert>
					)}
					<MapPictureNote state={picture} onRetry={mapPictures.retry} />
				</div>
			)}

			{location.point && (
				<Button size="sm" variant="ghost" className="w-fit text-muted" onPress={clearPlace}>
					<Icon name="x" size={14} />
					<Trans>Remove the city and map</Trans>
				</Button>
			)}

			<div className="grid gap-2">
				<span className="text-sm font-medium">
					<Trans>How you work</Trans>
				</span>
				{PORTFOLIO_WORK_MODES.map((mode) => (
					<CellSwitchRow
						key={mode}
						label={workModeLabel(mode)}
						isSelected={location.workModes.includes(mode)}
						onChange={(checked) =>
							editPortfolio((draft) => {
								const rest = draft.location.workModes.filter((entry) => entry !== mode);
								draft.location.workModes = checked
									? PORTFOLIO_WORK_MODES.filter((entry) => entry === mode || rest.includes(entry))
									: rest;
							})
						}
					/>
				))}
			</div>
			<CellSwitchRow
				isSelected={location.relocate}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.relocate = checked;
					})
				}
				label={t`Open to relocating`}
			/>
			<CellSwitchRow
				isSelected={location.showLocalTime}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.showLocalTime = checked;
						draft.location.timezone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
					})
				}
				label={t`Show my local time`}
			/>
			{location.showLocalTime && (
				<ChoiceSelect
					label={t`Time zone`}
					value={location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
					options={timeZoneOptions(location.timezone)}
					onChange={(zone) =>
						editPortfolio((draft) => {
							draft.location.timezone = zone;
						})
					}
				/>
			)}
		</div>
	);
}

type MapPictureNoteProps = { state: MapPictureState; onRetry: () => void };

function MapPictureNote({ state, onRetry }: MapPictureNoteProps) {
	if (state === "working")
		return (
			<p className="flex items-center gap-2 text-xs text-muted">
				<Spinner size="sm" />
				<Trans>Making the map picture for your page…</Trans>
			</p>
		);
	if (state === "failed")
		return (
			<div className="flex flex-wrap items-center gap-2 text-xs text-danger">
				<Trans>
					The map picture couldn't be made (the map service may be busy). Your page shows the card without a map.
				</Trans>
				<Button size="sm" variant="secondary" onPress={onRetry}>
					<Trans>Try again</Trans>
				</Button>
			</div>
		);
	if (state === "saved")
		return (
			<p className="text-body-xs text-muted">
				<Trans>Your page shows this map as a picture, in light and dark mode. © OpenStreetMap contributors.</Trans>
			</p>
		);
	return null;
}
