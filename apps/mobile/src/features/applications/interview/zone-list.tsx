// The interview's time zone, picked inside the same sheet (one native sheet at a time): a search over every zone,
// the user's and the device's first.
import type { InterviewEditor } from "./use-interview-editor";
import { useLingui } from "@lingui/react/macro";
import { useDeferredValue, useState } from "react";
import { View } from "react-native";
import { deviceTimeZone } from "@rezumi/career/time";
import { timeZones } from "@/lib/timezones";
import { Button, EmptyState, ListRow, ListSection, SearchField } from "@/ui";

const PAGE = 40;

type ZoneListProps = { editor: InterviewEditor };

export function ZoneList({ editor }: ZoneListProps) {
	const { t } = useLingui();
	const [query, setQuery] = useState("");
	const [limit, setLimit] = useState(PAGE);
	const deferred = useDeferredValue(query);
	const mine = editor.userTime.timeZone;
	const first = [...new Set([mine, deviceTimeZone()])];
	const all = [...first, ...timeZones.filter((zone) => !first.includes(zone))];
	const needle = deferred.trim().toLowerCase().replaceAll(" ", "_");
	const matches = needle ? all.filter((zone) => zone.toLowerCase().includes(needle)) : all;
	const pick = (zone: string) => {
		editor.set("timezone", zone);
		editor.setView("form");
	};
	return (
		<View className="gap-3">
			<SearchField
				value={query}
				onChange={(value) => {
					setQuery(value);
					setLimit(PAGE);
				}}
			>
				<SearchField.Group>
					<SearchField.SearchIcon />
					<SearchField.Input
						placeholder={t`City or region`}
						accessibilityLabel={t`Search time zones`}
						autoCorrect={false}
					/>
					<SearchField.ClearButton />
				</SearchField.Group>
			</SearchField>
			{matches.length === 0 ? (
				<EmptyState kind="filtered" title={t`No time zone matches “${query.trim()}”.`} />
			) : (
				<ListSection>
					{matches.slice(0, limit).map((zone) => (
						<ListRow
							key={zone}
							title={zone.replaceAll("_", " ")}
							description={zone === mine ? t`Your time zone` : undefined}
							isSelected={zone === editor.draft.timezone}
							onPress={() => pick(zone)}
							chevron={false}
						/>
					))}
				</ListSection>
			)}
			{matches.length > limit ? (
				<Button variant="ghost" onPress={() => setLimit((count) => count + PAGE)}>
					<Button.Label>{t`Show more`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}
