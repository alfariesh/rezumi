import type { ReminderKind } from "@/features/reminders";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPermissionsAsync } from "expo-notifications";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, Linking } from "react-native";
import { SettingsPage } from "./layout";
import { reminderEnabled, setReminderEnabled } from "@/features/reminders";
import { ListRow, ListSection, Switch, showToast } from "@/ui";

export default function NotificationSettings() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const permissions = useQuery({ queryKey: ["notification-permission"], queryFn: getPermissionsAsync });
	const { refetch } = permissions;
	useFocusEffect(
		useCallback(() => {
			void refetch();
			const listener = AppState.addEventListener("change", (state) => {
				if (state === "active") void refetch();
			});
			return () => listener.remove();
		}, [refetch]),
	);
	const [preferences, setPreferences] = useState(() => ({
		interview: reminderEnabled("interview"),
		"follow-up": reminderEnabled("follow-up"),
	}));
	const changes = useMutation({
		mutationFn: ({ kind, enabled }: { kind: ReminderKind; enabled: boolean }) => setReminderEnabled(kind, enabled),
		onSettled: async () => {
			setPreferences({ interview: reminderEnabled("interview"), "follow-up": reminderEnabled("follow-up") });
			await queryClient.invalidateQueries({ queryKey: ["reminders"] });
		},
		onError: () => showToast({ title: t`Couldn't update reminders. Try again.`, variant: "danger" }),
	});
	const rows = [
		{ kind: "interview", label: t`Interview reminders`, icon: "calendar-blank" },
		{ kind: "follow-up", label: t`Follow-up reminders`, icon: "clock" },
	] as const;
	return (
		<SettingsPage title={t`Notifications`}>
			<ListSection
				title={t`Local reminders`}
				footer={t`Turning a type off removes its scheduled reminders from this device. Turn it back on to set new reminders in Applications.`}
			>
				{rows.map(({ kind, label, icon }) => (
					<ListRow
						key={kind}
						title={label}
						icon={icon}
						trailing={
							<Switch
								accessibilityLabel={label}
								isDisabled={changes.isPending}
								isSelected={preferences[kind]}
								onSelectedChange={(enabled) => changes.mutate({ kind, enabled })}
							/>
						}
					/>
				))}
			</ListSection>
			<ListSection>
				<ListRow
					title={t`System notification settings`}
					icon="gear-six"
					description={permissions.data?.granted === false ? t`System permission is off.` : undefined}
					onPress={() =>
						void Linking.openSettings().catch(() =>
							showToast({ title: t`Couldn't open system settings.`, variant: "danger" }),
						)
					}
				/>
			</ListSection>
		</SettingsPage>
	);
}
