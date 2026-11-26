import type { Locale } from "@rezumi/utils/locale";
import { useLingui } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { DevSettings } from "react-native";
import { isLocale, localeSchema } from "@rezumi/utils/locale";
import { SettingsPage } from "./layout";
import { localeMap } from "./locale-names";
import { useProfile } from "./queries";
import { client, orpc } from "@/api/client";
import { getDeviceLocale, getLocalePreference, setLocalePreference } from "@/i18n";
import { timeZones } from "@/lib/timezones";
import { routes } from "@/routes";
import {
	ConfirmDialog,
	EmptyState,
	ListRow,
	ListSection,
	PickerSheet,
	Switch,
	haptics,
	setHapticsEnabled,
	setThemePreference,
	showToast,
	useHapticsEnabled,
	useThemePreference,
} from "@/ui";

const system = "system";

export default function PreferencesScreen() {
	const { t, i18n } = useLingui();
	const router = useRouter();
	const theme = useThemePreference();
	const hapticsOn = useHapticsEnabled();
	const profile = useProfile();
	const queryClient = useQueryClient();
	const [locale, setLocale] = useState(getLocalePreference);
	const [picker, setPicker] = useState<"theme" | "language" | "timezone" | null>(null);
	const [changingLanguage, setChangingLanguage] = useState(false);
	const [restart, setRestart] = useState(false);
	const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	const timezone = useMutation({
		mutationKey: ["settings", "timezone"],
		mutationFn: async (value: string) => {
			const result = await client.auth.updateProfile({ timezone: value });
			if (!result.status) throw new Error("Timezone update rejected");
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.auth.getProfile.key() }),
		onError: () => showToast({ title: t`Couldn't save the timezone. Try again.`, variant: "danger" }),
	});
	const languageName = (value: Locale) => i18n._(localeMap[value]);
	const languages = [
		{ value: system, label: t`System`, detail: languageName(getDeviceLocale()) },
		...localeSchema.options.map((value) => ({ value, label: languageName(value), detail: value })),
	];
	const zones = [
		...new Set([deviceTimezone, "UTC", ...(profile.data ? [profile.data.timezone] : []), ...timeZones]),
	].map((value) => ({ value, label: value, detail: value === deviceTimezone ? t`This device` : undefined }));
	const themes = [
		{ value: "system", label: t`System` },
		{ value: "light", label: t`Light` },
		{ value: "dark", label: t`Dark` },
	];
	const themeName = themes.find(({ value }) => value === theme)?.label;
	const chooseLanguage = async (value: string) => {
		if (value !== system && !isLocale(value)) return;
		const preference = value === system ? null : value;
		setChangingLanguage(true);
		try {
			const needsRestart = await setLocalePreference(preference);
			setLocale(preference);
			setRestart(needsRestart);
		} catch {
			showToast({ title: t`Couldn't change the language. Try again.`, variant: "danger" });
		} finally {
			setChangingLanguage(false);
		}
	};
	const open = (pane: "notifications" | "storage" | "ai" | "licences") => () => router.push(routes.account(pane));

	return (
		<SettingsPage onRefresh={profile.refetch} title={t`App settings`}>
			<ListSection title={t`Appearance`}>
				<ListRow
					testID="settings-theme"
					title={t`Theme`}
					description={themeName}
					icon="circle-half"
					onPress={() => setPicker("theme")}
				/>
				<ListRow
					title={t`Haptic feedback`}
					icon="vibrate"
					trailing={
						<Switch
							accessibilityLabel={t`Haptic feedback`}
							isSelected={hapticsOn}
							onSelectedChange={(value) => {
								setHapticsEnabled(value);
								haptics.selection();
							}}
						/>
					}
				/>
			</ListSection>
			<ListSection title={t`Language and region`}>
				<ListRow
					testID="settings-language"
					title={t`Language`}
					description={locale ? languageName(locale) : t`System`}
					icon="translate"
					isDisabled={changingLanguage}
					onPress={() => setPicker("language")}
				/>
				<ListRow
					title={t`Timezone`}
					description={profile.data?.timezone}
					icon="clock"
					isDisabled={!profile.data || timezone.isPending}
					onPress={() => setPicker("timezone")}
				/>
				{profile.isError ? (
					<EmptyState
						kind="inline"
						title={t`Couldn't load your timezone.`}
						action={{ label: t`Try again`, onPress: () => void profile.refetch() }}
					/>
				) : null}
			</ListSection>
			<ListSection title={t`Device and services`}>
				<ListRow title={t`Notifications`} icon="bell" onPress={open("notifications")} />
				<ListRow title={t`AI & developer`} icon="robot" onPress={open("ai")} />
				<ListRow title={t`Offline storage`} icon="file-text" onPress={open("storage")} />
				<ListRow title={t`Open-source licenses`} icon="file-text" onPress={open("licences")} />
			</ListSection>
			<PickerSheet
				isOpen={picker === "language"}
				onOpenChange={(open) => {
					if (!open) setPicker(null);
				}}
				title={t`Language`}
				closeLabel={t`Close`}
				searchLabel={t`Search languages`}
				emptyLabel={() => t`No language matches.`}
				options={languages}
				value={locale ?? system}
				onPick={(value) => void chooseLanguage(value)}
			/>
			<PickerSheet
				isOpen={picker === "timezone"}
				onOpenChange={(open) => {
					if (!open) setPicker(null);
				}}
				title={t`Timezone`}
				closeLabel={t`Close`}
				searchLabel={t`Search timezones`}
				emptyLabel={() => t`No timezone matches.`}
				options={zones}
				value={profile.data?.timezone ?? null}
				onPick={(value) => timezone.mutate(value)}
			/>
			<PickerSheet
				isOpen={picker === "theme"}
				onOpenChange={(open) => {
					if (!open) setPicker(null);
				}}
				title={t`Theme`}
				closeLabel={t`Close`}
				searchLabel={t`Search themes`}
				emptyLabel={() => t`No theme matches.`}
				options={themes}
				value={theme}
				onPick={(value) => {
					if (value !== "light" && value !== "dark" && value !== "system") return;
					try {
						setThemePreference(value);
					} catch {
						showToast({ title: t`Couldn't save the theme. Try again.`, variant: "danger" });
					}
				}}
			/>
			<ConfirmDialog
				isOpen={restart}
				onOpenChange={setRestart}
				title={t`Restart to change text direction`}
				message={t`Your language is saved. Restart Rezumi to apply the new left-to-right or right-to-left layout.`}
				confirmLabel={__DEV__ ? t`Reload now` : t`Done`}
				cancelLabel={t`Later`}
				onConfirm={() => {
					if (__DEV__) DevSettings.reload();
				}}
			/>
		</SettingsPage>
	);
}
