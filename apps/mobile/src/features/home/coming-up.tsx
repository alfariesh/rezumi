// Coming up: the next interview of an open application, with its countdown and whether its briefing is ready. Shows
// nothing when none is coming (the web's Home does the same).
import type { HomeTime } from "./time";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useBriefings } from "./queries";
import { HomeSection, LoadError } from "./section";
import { useApplications } from "@/features/applications/queries";
import { collectInterviews } from "@/features/career/scheduling";
import { routes } from "@/routes";
import { Button, Chip, Icon, Skeleton, StageDot, Text } from "@/ui";

type ComingUpProps = { now: Date; time: HomeTime };

export function ComingUp({ now, time }: ComingUpProps) {
	const { t } = useLingui();
	const router = useRouter();
	const applications = useApplications();
	const briefings = useBriefings();

	if (applications.isError || briefings.isError)
		return (
			<HomeSection title={t`Coming up`} icon="calendar-blank">
				<LoadError
					onRetry={() => {
						void applications.refetch();
						void briefings.refetch();
					}}
				/>
			</HomeSection>
		);
	if (applications.isPending) return <Skeleton variant="none" className="h-36 rounded-3xl" />;
	const next = collectInterviews(applications.data ?? [], now)[0];
	if (!next) return null;
	if (briefings.isPending) return <Skeleton variant="none" className="h-36 rounded-3xl" />;

	const { application, interview, start } = next;
	const kinds: Record<string, string> = {
		technical: t`Technical interview`,
		screening: t`Screening interview`,
		behavioral: t`Behavioral interview`,
		onsite: t`Onsite interview`,
	};
	const ready = briefings.data?.some((item) => item.interviewId === interview.id);
	const minutes = Math.round((start.getTime() - now.getTime()) / 60_000);
	const soon = minutes <= 60;
	// Hermes has no Intl.RelativeTimeFormat: hours, then days, as translated plurals.
	const hours = Math.round(minutes / 60);
	const days = Math.round(minutes / 1440);
	const countdown =
		minutes <= 0
			? t`Started`
			: soon
				? plural(minutes, { one: "Starts in # minute", other: "Starts in # minutes" })
				: minutes < 48 * 60
					? plural(hours, { one: "In # hour", other: "In # hours" })
					: plural(days, { one: "In # day", other: "In # days" });
	// Hermes formats unit "minute" wrongly ("2,700s" for 45): a translated plural instead.
	const duration = plural(interview.durationMinutes, { one: "# min", other: "# min" });

	return (
		<HomeSection title={t`Coming up`} icon="calendar-blank" testID="home-coming-up">
			<View className="flex-row items-start gap-3">
				<View className="w-14 items-stretch gap-0.5 rounded-xl bg-accent p-1">
					<Text size="xs" weight="semibold" className="text-center text-accent-foreground">
						{time.format(start, { weekday: "short" })}
					</Text>
					<View className="rounded-lg bg-surface/40 py-1">
						<Text size="base" weight="semibold" tabular className="text-center text-xl text-accent-foreground">
							{time.format(start, { day: "numeric" })}
						</Text>
					</View>
				</View>
				<View className="flex-1 gap-0.5">
					<View className="flex-row items-center gap-1.5">
						<StageDot stage={application.status} />
						<Text weight="semibold" className="shrink">
							{kinds[interview.kind] ?? t`Interview`}
						</Text>
					</View>
					<Text tone="muted" numberOfLines={2}>
						{[application.company, time.time(start), duration].join(" · ")}
					</Text>
				</View>
			</View>
			<View className="flex-row flex-wrap gap-1.5">
				<Chip size="sm" variant="soft" color={soon ? "warning" : "default"}>
					<Icon name="clock" size={16} tone={soon ? "warning" : "muted"} />
					<Chip.Label>{countdown}</Chip.Label>
				</Chip>
				{ready ? (
					<Chip size="sm" variant="soft" color="success">
						<Icon name="check" size={16} tone="success" />
						<Chip.Label>{t`Briefing ready`}</Chip.Label>
					</Chip>
				) : null}
			</View>
			<Button variant="secondary" size="sm" onPress={() => router.push(routes.application(application.id, "prepare"))}>
				<Button.Label>{t`Open workspace`}</Button.Label>
				<Icon name="arrow-right" size={16} tone="accent" />
			</Button>
		</HomeSection>
	);
}
