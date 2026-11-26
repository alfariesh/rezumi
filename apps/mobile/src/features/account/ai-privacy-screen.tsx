import type { Schedule } from "@/features/home/queries";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SettingsPage } from "./layout";
import { isAiSharingBlocked, setAiSharingBlocked } from "@/api/ai-privacy";
import { client, orpc } from "@/api/client";
import { useApplications } from "@/features/applications/queries";
import { useSchedules } from "@/features/home/queries";
import { ConfirmDialog, EmptyState, ListRow, ListSection, Skeleton, Switch, showToast } from "@/ui";

export default function AiPrivacyScreen() {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const [blocked, setBlocked] = useState(isAiSharingBlocked);
	const [selected, setSelected] = useState<Schedule | null>(null);
	const schedules = useSchedules();
	const applications = useApplications();
	const revoke = useMutation({
		mutationFn: (id: string) => client.career.revokeScheduleAi({ id }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: orpc.career.schedules.key() });
			showToast({ title: t`Approval withdrawn`, variant: "success" });
		},
		onError: () => showToast({ title: t`Couldn't withdraw approval. Try again.`, variant: "danger" }),
	});
	const active = schedules.data?.filter((row) => row.kind === "prepare" && row.enabled);

	return (
		<SettingsPage
			title={t`AI data sharing`}
			onRefresh={() => Promise.allSettled([schedules.refetch(), applications.refetch()])}
		>
			<ListSection footer={t`Rezumi asks before each AI operation. Individual approvals expire after that operation.`}>
				<ListRow
					title={t`Block AI sharing on this device`}
					icon="shield-check"
					trailing={
						<Switch
							accessibilityLabel={t`Block AI sharing on this device`}
							isSelected={blocked}
							onSelectedChange={(value) => {
								try {
									setAiSharingBlocked(value);
									setBlocked(value);
								} catch {
									showToast({ title: t`Couldn't save your sharing preference. Try again.`, variant: "danger" });
								}
							}}
						/>
					}
				/>
			</ListSection>
			<ListSection
				title={t`Scheduled AI approvals`}
				footer={t`Withdrawing approval pauses the schedule on all devices.`}
			>
				{schedules.isPending ? <Skeleton variant="none" className="m-3 h-12 rounded-xl" /> : null}
				{schedules.isError ? (
					<EmptyState
						kind="inline"
						title={t`Couldn't load scheduled AI approvals.`}
						action={{ label: t`Try again`, onPress: () => void schedules.refetch() }}
					/>
				) : null}
				{active?.length === 0 ? <ListRow title={t`No scheduled AI approvals.`} icon="clock" /> : null}
				{active?.map((row) => {
					const application = applications.data?.find((item) => item.id === row.applicationId);
					return (
						<ListRow
							key={row.id}
							title={application?.company ?? t`Interview preparation`}
							description={i18n.date(row.nextRunAt, {
								dateStyle: "medium",
								timeStyle: "short",
								timeZone: row.timezone,
							})}
							icon="calendar-blank"
							value={t`Withdraw`}
							chevron={false}
							isDisabled={revoke.isPending}
							onPress={() => setSelected(row)}
						/>
					);
				})}
			</ListSection>
			<ConfirmDialog
				isOpen={selected !== null}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
				title={t`Withdraw AI approval?`}
				message={t`This pauses the interview preparation schedule. You can enable it again from Home.`}
				confirmLabel={t`Withdraw approval`}
				cancelLabel={t`Keep approval`}
				destructive
				onConfirm={() => {
					if (selected) revoke.mutate(selected.id);
				}}
			/>
		</SettingsPage>
	);
}
