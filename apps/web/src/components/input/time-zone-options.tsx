import type { ComboboxOption } from "@/components/ui/combobox";
import { Icon } from "@rezumi/ui/components/icon";
import { countryForTimeZone } from "@rezumi/utils/region";
import { FlagIcon } from "@/components/flag-icon";

/** A time zone as a Combobox option: its country's flag (a globe for UTC and the like) and the name without underscores. */
export function timeZoneOption(zone: string): ComboboxOption {
	const country = countryForTimeZone(zone);
	return {
		value: zone,
		label: zone.replaceAll("_", " "),
		keywords: [zone],
		icon: country ? (
			<FlagIcon code={country} />
		) : (
			<Icon name="globe-hemisphere-west" size={16} className="shrink-0 text-muted" />
		),
	};
}
