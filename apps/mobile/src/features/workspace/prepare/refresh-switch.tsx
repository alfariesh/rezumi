// The prepare schedule for this interview: switching it here changes it on Home too (one schedules query).
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSchedules, workspaceError } from "../queries";
import { orpc } from "@/api/client";
import { useFlags } from "@/api/flags";
import { useHasAIProvider } from "@/features/ai/providers";
import { useUserTime } from "@/features/applications/date";
import { ListGroup, ListRow, Switch, showToast } from "@/ui";

const LEADS = ["24h", "2h", "morning"] as const;

type RefreshSwitchProps = { application: Application; interview: InterviewTimelineEntry };

export function RefreshSwitch({ application, interview }: RefreshSwitchProps) {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const { when, timeZone } = useUserTime();
	const connection = useHasAIProvider();
	const flags = useFlags();
	const schedules = useSchedules();
	const schedule = schedules.data?.find((item) => item.kind === "prepare" && item.interviewId === interview.id);
	const lead = LEADS.find((item) => item === schedule?.lead) ?? "24h";
	// The schedule's own connection while it's switched on and tested; otherwise the default, as the run itself does.
	const own = connection.usableProviders.find((item) => item.id === schedule?.aiProviderId);
	const provider = own ?? connection.defaultProvider;
	const providerId = provider?.id ?? null;
	const providerLabel = provider?.label ?? "";
	const runAt = schedule?.nextRunAt ?? new Date(new Date(interview.at).getTime() - 24 * 3_600_000);
	const scheduling = flags.data?.careerSchedulingEnabled !== false;

	const save = useMutation({
		...orpc.career.saveSchedule.mutationOptions(),
		onSuccess: (row) => {
			void queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
			const next = when(row.nextRunAt);
			showToast({ title: row.enabled ? t`Briefing refresh is on · ${next}` : t`Briefing refresh paused` });
		},
		onError: (error) =>
			showToast({ title: workspaceError(error, t`Couldn't change the schedule. Try again.`), variant: "danger" }),
	});

	const enabled = (save.isPending ? save.variables.enabled : schedule?.enabled) ?? false;
	const available = !connection.isUnavailable && scheduling && !!providerId;
	const label = {
		"24h": t`Refresh the briefing 24 hours before`,
		"2h": t`Refresh the briefing 2 hours before`,
		morning: t`Refresh the briefing on the morning of`,
	}[lead];
	const at = when(runAt);
	const description = !scheduling
		? t`Scheduled work isn't available on this server.`
		: connection.isUnavailable
			? t`AI connections are unavailable.`
			: !providerId
				? t`Connect an AI provider in Settings to refresh it automatically.`
				: t`${at} · ${providerLabel}. Sends this application and your Profile; your provider may charge.`;

	return (
		<ListGroup>
			<ListRow
				title={label}
				description={description}
				trailing={
					<Switch
						isSelected={enabled}
						isDisabled={save.isPending || (!available && !enabled)}
						accessibilityLabel={label}
						onSelectedChange={(checked) =>
							save.mutate({
								...(schedule ? { id: schedule.id } : {}),
								kind: "prepare",
								applicationId: application.id,
								interviewId: interview.id,
								lead,
								enabled: checked,
								email: schedule?.email ?? false,
								timezone: timeZone,
								locale: i18n.locale,
								nextRunAt: new Date(runAt),
								aiProviderId: providerId,
								query: "",
								intervalDays: null,
							})
						}
					/>
				}
			/>
		</ListGroup>
	);
}
