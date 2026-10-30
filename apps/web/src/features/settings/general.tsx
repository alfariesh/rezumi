import type { IconName } from "@rezumi/ui/components/icon";
import { Segment } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { SettingsRow, SettingsSection } from "./section";
import { Combobox } from "@/components/ui/combobox";
import { LocaleCombobox } from "@/features/locale/combobox";
import { useTheme } from "@/features/theme/provider";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { sessionQueryKey } from "@/libs/root-context";
import { isTheme, themeMap, type Theme } from "@/libs/theme";

const THEMES: Array<{ value: Theme; icon: IconName }> = [
	{ value: "light", icon: "sun" },
	{ value: "dark", icon: "moon" },
	{ value: "system", icon: "circle-half" },
];

const controlClass = "w-64 max-sm:w-full";

/** Theme, language and timezone: how the app looks and reads for you. Each applies as soon as it's chosen. */
export function GeneralSection() {
	const languageId = useId();

	return (
		<SettingsSection id="general" divided title={<Trans>General</Trans>}>
			<SettingsRow
				icon="palette"
				title={<Trans>Theme</Trans>}
				description={<Trans>Resumes always render on white paper, whatever the theme.</Trans>}
			>
				<ThemeSwitch />
			</SettingsRow>

			<SettingsRow
				icon="translate"
				title={<Trans>Language</Trans>}
				description={<Trans>Interface only. Each resume sets its own language in Design.</Trans>}
			>
				<div className={controlClass}>
					<label htmlFor={languageId} className="sr-only">
						<Trans>Interface language</Trans>
					</label>
					<LocaleCombobox id={languageId} variant="secondary" />
				</div>
			</SettingsRow>

			<TimezoneSetting />
		</SettingsSection>
	);
}

const timeZones = Intl.supportedValuesOf("timeZone").map((zone) => ({ value: zone, label: zone }));

/** The account's timezone, which interview times, reminders and schedules use. Saved as soon as it's chosen. */
function TimezoneSetting() {
	const id = useId();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { session } = useRouteContext({ strict: false });
	const saved = session?.user.timezone ?? "UTC";
	const [value, setValue] = useState(saved);
	const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

	const save = async (timezone: string) => {
		const previous = value;
		setValue(timezone);
		const { error } = await authClient.updateUser({ timezone });
		if (error) {
			setValue(previous);
			toast.add({
				type: "error",
				description: getReadableErrorMessage(error, t`Couldn't save the timezone. Try again.`),
			});
			return;
		}
		await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
		await router.invalidate();
	};

	return (
		<div id="timezone" className="grid scroll-mt-16 gap-3">
			<SettingsRow
				icon="clock"
				title={<Trans>Timezone</Trans>}
				description={<Trans>Interview times, reminders and schedules in Career use it.</Trans>}
			>
				<div className={controlClass}>
					<label htmlFor={id} className="sr-only">
						<Trans>Timezone</Trans>
					</label>
					<Combobox
						id={id}
						variant="secondary"
						showClear={false}
						options={timeZones}
						value={value}
						placeholder={t`Search timezones`}
						emptyMessage={t`No timezone matches.`}
						onValueChange={(zone) => zone && zone !== value && void save(zone)}
					/>
				</div>
			</SettingsRow>
			{device && device !== value && (
				<Button size="sm" variant="secondary" className="ms-row-indent w-fit" onPress={() => void save(device)}>
					<Trans>Use this device's timezone ({device})</Trans>
				</Button>
			)}
		</div>
	);
}

/** Light, Dark and System; the choice applies at once. */
function ThemeSwitch() {
	const { i18n } = useLingui();
	const { theme, setTheme } = useTheme();

	return (
		<Segment
			aria-label={t`Theme`}
			selectedKey={theme}
			// Grows with long translated labels instead of clipping them.
			className="w-fit min-w-64 max-sm:w-full"
			onSelectionChange={(key) => {
				const next = String(key);
				if (isTheme(next)) setTheme(next);
			}}
		>
			{THEMES.map((option) => (
				<Segment.Item key={option.value} id={option.value} className="flex-1 gap-1.5">
					<Icon name={option.icon} size={16} />
					{i18n.t(themeMap[option.value])}
				</Segment.Item>
			))}
		</Segment>
	);
}
