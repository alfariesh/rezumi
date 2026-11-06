import type { City } from "./cities";
import type { MapPrecision } from "./map-config";
import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import { Alert, Button, Checkbox, Label, RadioGroup, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PORTFOLIO_WORK_MODES } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { pageLocaleOf, useSourceResume } from "../editor/context";
import { ChoiceSelect, RadioOption, TextInput } from "../editor/fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "../editor/store";
import { uploadPortfolioImage } from "../images/upload";
import { areaCenter, cityLabel, countryNames, findCity, searchCities } from "./cities";
import { loadCities } from "./load-cities";

const LocationMap = lazy(() => import("./location-map"));

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

/** The nearest listed city to a point (a saved location, before the list knew which city it was). */
function nearestCity(cities: readonly City[], point: { lat: number; lng: number }): City | null {
	let best: City | null = null;
	let distance = Number.POSITIVE_INFINITY;
	for (const city of cities) {
		const next = (city.lat - point.lat) ** 2 + (city.lng - point.lng) ** 2;
		if (next < distance) {
			distance = next;
			best = city;
		}
	}
	return best;
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

type MapPictureStatus = "idle" | "working" | "saved" | "failed";

/** What a map picture shows: the point and precision, while the map is on. */
function pointSignature(location: PortfolioLocation): string | null {
	const { point } = location;
	return location.showMap && point ? `${point.lat},${point.lng},${point.precision}` : null;
}

/**
 * Keeps `location.map` in step with the point (`02-teknis.md` section 24): while the map is on, a change of point or
 * precision makes new light and dark pictures (off screen, after a short pause) and uploads them; turning the map off
 * removes them. A picture finished for a point that changed meanwhile is dropped.
 */
function useMapPictures(location: PortfolioLocation) {
	const signature = pointSignature(location);
	const hasMap = Boolean(location.map);
	// A saved picture belongs to the point it was saved with; only a later change remakes it.
	const made = useRef<string | null>(hasMap ? signature : null);
	const [status, setStatus] = useState<MapPictureStatus>(hasMap ? "saved" : "idle");
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!signature || (made.current === signature && hasMap)) return;
		let cancelled = false;
		const timer = setTimeout(async () => {
			const point = usePortfolioEditorStore.getState().portfolio?.data.location.point;
			if (!point) return;
			setStatus("working");
			try {
				const { snapshotMap } = await import("./map-snapshot");
				const pictures = await snapshotMap(point, point.precision);
				if (cancelled) return;
				const [light, dark] = await Promise.all([
					uploadPortfolioImage(new File([pictures.light], "map-light.png", { type: "image/png" })),
					uploadPortfolioImage(new File([pictures.dark], "map-dark.png", { type: "image/png" })),
				]);
				const current = usePortfolioEditorStore.getState().portfolio?.data.location;
				if (cancelled || !current || pointSignature(current) !== signature) return;
				made.current = signature;
				editPortfolio((draft) => {
					draft.location.map = { light, dark };
				});
				setStatus("saved");
			} catch {
				if (cancelled) return;
				// The page shows the card without a map rather than an old place's picture.
				editPortfolio((draft) => {
					delete draft.location.map;
				});
				setStatus("failed");
			}
		}, 1200);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [signature, hasMap, attempt]);

	return { status, retry: () => setAttempt((value) => value + 1) };
}

/**
 * The Location card's form (`01-desain.md` section 19): pick a city from the bundled list (first suggestion from the
 * resume's location), choose how precise to be, and optionally show a map. Privacy first: the map is off by default,
 * the pin sits at the city's centre, and there's no "use my location".
 */
export function LocationFields() {
	const data = usePortfolioData();
	const { location } = data;
	const source = useSourceResume();
	const resumeLocation = source.data?.basics.location ?? "";
	const pageLocale = pageLocaleOf(data, source.data);
	const names = useMemo(() => countryNames(pageLocale), [pageLocale]);
	const appNames = useMemo(() => countryNames(navigator.language), []);
	const { cities, failed, load } = useCities();
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [city, setCity] = useState<City | null>(null);
	const pictures = useMapPictures(location);
	const precision = location.point?.precision ?? "city";
	const hasPoint = Boolean(location.point);

	// Without a city yet, the list loads at once so the resume's location can be offered.
	useEffect(() => {
		if (!hasPoint) void load();
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- `load` is remade each render; loading once is enough.
	}, [hasPoint]);

	const results = cities && searching ? searchCities(cities, query, appNames, 6) : [];
	const suggestion =
		cities && !location.point && !query.trim() ? findCity(cities, location.label || resumeLocation, appNames) : null;

	const place = (chosen: City, nextPrecision: MapPrecision) => {
		const all = cities ?? [];
		setCity(chosen);
		setQuery("");
		setSearching(false);
		editPortfolio(
			(draft) => {
				draft.location.point = { ...areaCenter(all, chosen, nextPrecision), precision: nextPrecision };
				draft.location.label = cityLabel(chosen, nextPrecision, names);
				draft.location.timezone = chosen.timezone;
			},
			{ structural: true },
		);
	};

	const changePrecision = async (next: MapPrecision) => {
		const list = await load();
		const chosen =
			city ??
			(list && (findCity(list, location.label, names) ?? (location.point ? nearestCity(list, location.point) : null)));
		if (chosen) place(chosen, next);
	};

	const clearPlace = () => {
		setCity(null);
		editPortfolio(
			(draft) => {
				delete draft.location.point;
				delete draft.location.map;
				draft.location.showMap = false;
			},
			{ structural: true },
		);
	};

	return (
		<div className="grid gap-3 rounded-2xl bg-surface-secondary p-3">
			<span className="text-sm font-medium">
				<Trans>Location card</Trans>
			</span>

			<div className="grid gap-2">
				<TextInput
					label={location.point ? t`Change the city` : t`Find your city`}
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
					<p className="text-xs text-danger">
						<Trans>The city list didn't load. Check your connection, then type again.</Trans>
					</p>
				)}
				{searching && query.trim() && cities && (
					<ul className="grid gap-1" aria-label={t`Cities`}>
						{results.map((result) => (
							<li key={`${result.name}-${result.country}-${result.lat}-${result.lng}`}>
								<Button
									variant="ghost"
									className="h-auto w-full justify-start py-1.5 text-start"
									onPress={() => place(result, precision)}
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
						{results.length === 0 && (
							<li className="px-2 text-xs text-muted">
								<Trans>No city by that name. Larger towns are listed; type the nearest one, then edit the label.</Trans>
							</li>
						)}
					</ul>
				)}
				{suggestion && (
					<div className="flex flex-wrap items-center gap-2 text-sm">
						<span className="text-muted">
							<Trans>From your resume:</Trans>{" "}
							<b className="text-foreground">
								{suggestion.name}, {appNames(suggestion.country)}
							</b>
						</span>
						<Button size="sm" variant="secondary" onPress={() => place(suggestion, "city")}>
							<Trans>Use this city</Trans>
						</Button>
					</div>
				)}
				<p className="text-xs text-muted">
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
				placeholder={resumeLocation || t`Bandung, Indonesia`}
				description={resumeLocation ? t`Empty uses your resume's: ${resumeLocation}` : undefined}
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
				<RadioGroup
					value={precision}
					orientation="horizontal"
					onChange={(value) => void changePrecision(value as MapPrecision)}
				>
					<Label>
						<Trans>How precise</Trans>
					</Label>
					<div className="flex flex-wrap gap-x-3">
						{(["city", "region", "country"] as const).map((option) => (
							<RadioOption key={option} value={option}>
								{precisionLabel(option)}
							</RadioOption>
						))}
					</div>
				</RadioGroup>
			)}

			<SwitchRow
				isSelected={location.showMap}
				isDisabled={!location.point}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.showMap = checked;
						if (!checked) delete draft.location.map;
					})
				}
				label={t`Show a map on my page`}
				description={
					location.point
						? t`Off by default. The page shows a picture of the map, so visitors aren't tracked by a map service.`
						: t`Choose a city first.`
				}
				className="items-start py-0"
			/>

			{location.showMap && location.point && (
				<div className="grid gap-2">
					<Suspense
						fallback={
							<div className="grid aspect-5/3 place-items-center rounded-xl border border-border">
								<Spinner size="sm" />
							</div>
						}
					>
						<LocationMap
							point={location.point}
							precision={precision}
							label={location.label}
							onMove={(point) =>
								editPortfolio(
									(draft) => {
										if (draft.location.point) Object.assign(draft.location.point, point);
									},
									{ structural: true },
								)
							}
						/>
					</Suspense>
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
					<MapPictureNote status={pictures.status} onRetry={pictures.retry} />
				</div>
			)}

			{location.point && (
				<Button size="sm" variant="ghost" className="w-fit text-muted" onPress={clearPlace}>
					<Icon name="x" size={14} />
					<Trans>Remove the city and map</Trans>
				</Button>
			)}

			<fieldset className="grid gap-1.5">
				<legend className="mb-1.5 text-sm font-medium">
					<Trans>How you work</Trans>
				</legend>
				<div className="flex flex-wrap gap-x-4 gap-y-2">
					{PORTFOLIO_WORK_MODES.map((mode) => (
						<Checkbox
							key={mode}
							isSelected={location.workModes.includes(mode)}
							onChange={(checked) =>
								editPortfolio((draft) => {
									const rest = draft.location.workModes.filter((entry) => entry !== mode);
									draft.location.workModes = checked
										? PORTFOLIO_WORK_MODES.filter((entry) => entry === mode || rest.includes(entry))
										: rest;
								})
							}
						>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
								<Label className="text-sm">{workModeLabel(mode)}</Label>
							</Checkbox.Content>
						</Checkbox>
					))}
				</div>
			</fieldset>
			<SwitchRow
				isSelected={location.relocate}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.relocate = checked;
					})
				}
				label={t`Open to relocating`}
				className="py-0"
			/>
			<SwitchRow
				isSelected={location.showLocalTime}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.showLocalTime = checked;
						draft.location.timezone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
					})
				}
				label={t`Show my local time`}
				description={t`Helps recruiters in other time zones know when to reach you.`}
				className="items-start py-0"
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

type MapPictureNoteProps = { status: MapPictureStatus; onRetry: () => void };

function MapPictureNote({ status, onRetry }: MapPictureNoteProps) {
	if (status === "working")
		return (
			<p className="flex items-center gap-2 text-xs text-muted">
				<Spinner size="sm" />
				<Trans>Making the map picture for your page…</Trans>
			</p>
		);
	if (status === "failed")
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
	if (status === "saved")
		return (
			<p className="text-xs text-muted">
				<Trans>Your page shows this map as a picture, in light and dark mode. © OpenStreetMap contributors.</Trans>
			</p>
		);
	return null;
}
