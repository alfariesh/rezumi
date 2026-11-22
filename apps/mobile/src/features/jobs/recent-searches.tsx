// The person's recent job searches (the web's recent-searches.tsx; `jobs.recent`, kept on the server, the same on
// every device), newest first. Each says whether opening it again today is free: the day's searches count pages, and
// a page opened today opens again for nothing. On Jobs' start as a list; over the results from a button, in a sheet.
import type { useRecentSearches } from "./queries";
import type { JobsSearch } from "@rezumi/career/jobs";
import type { JobSearchRecent } from "@rezumi/schema/jobs/search";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { fromCriteria } from "@rezumi/career/jobs";
import { countryName } from "@rezumi/utils/region";
import { searchFilterLabels } from "./format";
import { Button, Card, Chip, Icon, IconButton, Sheet, Skeleton, Text, Typography, showToast } from "@/ui";

type Recent = ReturnType<typeof useRecentSearches>;

type RecentSearchListProps = { recent: Recent; searches: JobSearchRecent[]; onOpen: (next: JobsSearch) => void };

function RecentSearchList({ recent, searches, onOpen }: RecentSearchListProps) {
	const { t, i18n } = useLingui();
	const forget = (search: JobSearchRecent) =>
		void recent.forget(search.id).catch(() => showToast({ title: t`That didn't save. Try again.`, variant: "danger" }));
	return (
		<View>
			{searches.map((search, index) => {
				const country = search.criteria.country ? countryName(search.criteria.country, i18n.locale) : "";
				const where = [search.criteria.location, country].filter(Boolean).join(", ") || t`Anywhere`;
				const details = [where, ...searchFilterLabels(search.criteria, i18n.locale)].join(" · ");
				return (
					<View
						key={search.id}
						className={
							index > 0
								? "flex-row items-center gap-3 border-t border-separator py-2.5"
								: "flex-row items-center gap-3 py-2.5"
						}
					>
						<Pressable
							onPress={() => onOpen(fromCriteria(search.criteria))}
							accessibilityRole="button"
							accessibilityHint={search.seenToday ? t`Free today` : t`Uses 1 search`}
							className="min-h-11 flex-1 flex-row items-center gap-3"
							testID={`recent-search-${search.id}`}
						>
							<Icon name="clock-counter-clockwise" size={18} tone="muted" />
							<View className="flex-1 gap-0.5">
								<Text weight="medium" numberOfLines={1}>
									{search.criteria.query}
								</Text>
								<Text size="xs" tone="muted" numberOfLines={1}>
									{details}
								</Text>
							</View>
							<Chip size="sm" variant="soft" color={search.seenToday ? "success" : "default"}>
								<Chip.Label>
									{search.seenToday
										? t({
												message: "Free today",
												comment: "A recent job search that opens again today without counting",
											})
										: t({
												message: "Uses 1 search",
												comment: "A recent job search that counts toward today's searches when opened",
											})}
								</Chip.Label>
							</Chip>
						</Pressable>
						<IconButton
							icon="x"
							size="sm"
							label={t`Remove ${search.criteria.query} from recent searches`}
							onPress={() => forget(search)}
						/>
					</View>
				);
			})}
		</View>
	);
}

type RecentSearchesCardProps = { recent: Recent; onOpen: (next: JobsSearch) => void };

/** Jobs' start: the recent searches to open again with one press. Nothing while there are none. */
export function RecentSearchesCard({ recent, onOpen }: RecentSearchesCardProps) {
	const { t } = useLingui();
	if (recent.isPending)
		return (
			<View className="gap-2" accessibilityLabel={t`Loading recent job searches`}>
				{Array.from({ length: 3 }, (_, index) => (
					<Skeleton key={index} className="h-14 rounded-xl" variant="none" />
				))}
			</View>
		);
	if (!recent.searches?.length) return null;
	return (
		<View className="gap-2">
			<View className="min-h-11 flex-row items-center gap-2">
				<Icon name="clock-counter-clockwise" size={20} tone="muted" />
				<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
					{t`Recent job searches`}
				</Typography.Heading>
				<Button size="sm" variant="ghost" onPress={() => void recent.clear()}>
					<Button.Label>{t({ message: "Clear", comment: "Removes every recent job search" })}</Button.Label>
				</Button>
			</View>
			<Card className="py-1">
				<RecentSearchList recent={recent} searches={recent.searches} onOpen={onOpen} />
			</Card>
		</View>
	);
}

/** Recent searches over the results: the screen shows the last search, so the others are one press away. */
export function RecentSearchesButton({ recent, onOpen }: RecentSearchesCardProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	if (!recent.searches || recent.searches.length < 2) return null;
	return (
		<>
			<Button size="sm" variant="ghost" onPress={() => setOpen(true)} testID="jobs-recent-open">
				<Icon name="clock-counter-clockwise" size={16} tone="muted" />
				<Button.Label>{t`Recent searches`}</Button.Label>
			</Button>
			<Sheet isOpen={open} onOpenChange={setOpen} title={t`Recent job searches`} closeLabel={t`Close`}>
				<RecentSearchList
					recent={recent}
					searches={recent.searches}
					onOpen={(next) => {
						setOpen(false);
						onOpen(next);
					}}
				/>
				<Button
					variant="ghost"
					onPress={() => {
						void recent.clear();
						setOpen(false);
					}}
				>
					<Button.Label>{t({ message: "Clear", comment: "Removes every recent job search" })}</Button.Label>
				</Button>
			</Sheet>
		</>
	);
}
