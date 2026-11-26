import type { IconName } from "@/ui";
import { useLingui } from "@lingui/react/macro";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Pressable, View } from "react-native";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { useBrowserLink } from "./browser";
import { SettingsPage } from "./layout";
import { Icon, ListRow, ListSection, Text } from "@/ui";

type HelpLink = { label: string; icon: IconName; url: string };

export default function HelpScreen() {
	const { t } = useLingui();
	const browse = useBrowserLink();
	const links: HelpLink[] = [
		{ label: t`Docs`, icon: "book-open", url: "https://rezumi.app/docs" },
		{ label: t`Contact & complaints`, icon: "chat-centered-text", url: LEGAL_URLS.contact },
		{ label: t`Privacy policy`, icon: "shield-check", url: LEGAL_URLS.privacy },
		{ label: t`Terms of service`, icon: "scroll", url: LEGAL_URLS.terms },
		{ label: t`Refund policy`, icon: "arrow-counter-clockwise", url: LEGAL_URLS.refund },
		{ label: t`MIT License`, icon: "code", url: LEGAL_URLS.license },
		{ label: t`Report an issue`, icon: "warning-circle", url: "https://github.com/alfariesh/rezumi/issues/new/choose" },
	];
	const version = Constants.expoConfig?.version;
	const build =
		Constants.platform?.ios?.buildNumber ??
		Constants.platform?.android?.versionCode ??
		Constants.expoConfig?.android?.versionCode ??
		Constants.expoConfig?.ios?.buildNumber;
	const update = !Updates.isEnabled ? t`Off` : Updates.isEmbeddedLaunch ? t`Bundled with app` : Updates.updateId;

	return (
		<SettingsPage title={t`Help & legal`}>
			<View className="flex-row flex-wrap gap-3">
				{links.map(({ label, icon, url }) => (
					<Pressable
						key={url}
						accessibilityRole="link"
						accessibilityLabel={label}
						className="min-h-28 min-w-36 flex-1 justify-between gap-3 rounded-2xl bg-surface p-4 active:bg-default"
						onPress={() => void browse(url)}
					>
						<View className="flex-row justify-between">
							<Icon name={icon} size={24} tone="accent" />
							<Icon name="arrow-up-right" size={16} tone="muted" />
						</View>
						<Text weight="semibold">{label}</Text>
					</Pressable>
				))}
			</View>
			<ListSection title={t`About Rezumi`}>
				<ListRow title={t`App version`} description={version ?? t`Unavailable`} />
				<ListRow title={t`Build number`} description={build == null ? t`Unavailable` : String(build)} />
				<ListRow title={t`Over-the-air update`} description={update ?? t`Unavailable`} />
				{Updates.runtimeVersion ? <ListRow title={t`Runtime version`} description={Updates.runtimeVersion} /> : null}
			</ListSection>
		</SettingsPage>
	);
}
