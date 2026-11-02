import { Trans, useLingui } from "@lingui/react/macro";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { View } from "react-native";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { canShowPlans, getPlanName, usePlan } from "@/features/billing/plan";
import { SettingsGroup, SettingsPage } from "@/features/settings/layout";
import { useProfile } from "@/features/settings/queries";
import { SignOutRow } from "@/features/settings/sign-out";
import { routes } from "@/routes";
import { Avatar, ListRow, Text, showToast, useTheme, useThemePreference } from "@/ui";

export default function SettingsScreen() {
	const router = useRouter();
	const { t } = useLingui();
	const { space } = useTheme();
	const profile = useProfile();
	const plan = usePlan();
	const openLink = (url: string) => {
		void openBrowserAsync(url).catch(() => showToast({ message: t`Couldn't open the browser. Try again.` }));
	};
	const theme = useThemePreference();
	const appearance = { system: t`System`, light: t`Light`, dark: t`Dark` }[theme];
	return (
		<SettingsPage onRefresh={profile.refetch} title={t`Settings`} root>
			<SettingsGroup>
				<ListRow
					title={profile.data?.name ?? t`Account`}
					subtitle={profile.data?.email}
					leading={<Avatar name={profile.data?.name ?? t`Account`} uri={profile.data?.image} />}
					chevron
					onPress={() => router.push(routes.settings("account"))}
				/>
			</SettingsGroup>
			<SettingsGroup>
				<ListRow
					title={t`Preferences`}
					leading="circle-half"
					value={appearance}
					chevron
					onPress={() => router.push(routes.settings("preferences"))}
				/>
				<ListRow title={t`AI & developer`} leading="robot" chevron onPress={() => router.push(routes.settings("ai"))} />
				{/* Android shows the plan without selling it; iOS shows nothing about plans (store rules). */}
				{canShowPlans() && plan?.enabled ? (
					<ListRow
						title={t`Plan`}
						leading="seal-check"
						value={getPlanName(plan.planId)}
						chevron
						onPress={() => router.push(routes.settings("membership"))}
					/>
				) : null}
			</SettingsGroup>
			<SettingsGroup>
				<SignOutRow switchServer />
			</SettingsGroup>
			<SettingsGroup title={t`Support`}>
				<ListRow
					title={t`Help & docs`}
					leading="question"
					external
					onPress={() => openLink("https://docs.rezumi.app")}
				/>
				<ListRow
					title={t`Contact & complaints`}
					leading="question"
					external
					onPress={() => openLink(LEGAL_URLS.contact)}
				/>
			</SettingsGroup>
			<SettingsGroup title={t`Legal`}>
				<ListRow
					title={t`Privacy policy`}
					leading="shield-check"
					external
					onPress={() => openLink(LEGAL_URLS.privacy)}
				/>
				<ListRow title={t`Terms of service`} leading="scroll" external onPress={() => openLink(LEGAL_URLS.terms)} />
				<ListRow title={t`Refund policy`} leading="scroll" external onPress={() => openLink(LEGAL_URLS.refund)} />
				<ListRow title={t`MIT License`} leading="scales" external onPress={() => openLink(LEGAL_URLS.license)} />
				<ListRow
					title={t`Open-source licenses`}
					leading="file-text"
					chevron
					onPress={() => router.push("/(tabs)/settings/licences")}
				/>
			</SettingsGroup>
			<SettingsGroup>
				<SignOutRow />
			</SettingsGroup>
			<View style={{ alignItems: "center", gap: space.s1 }}>
				<Text variant="caption" color="ink3" align="center">
					Rezumi
				</Text>
				<Text variant="caption" color="ink3" align="center">
					<Trans>
						by{" "}
						<Text
							variant="caption"
							color="accentText"
							accessibilityRole="link"
							onPress={() => openLink("https://rezumi.app")}
							style={{ textDecorationLine: "underline" }}
						>
							Salman Alfariesh
						</Text>
					</Trans>
				</Text>
				<Text variant="caption" color="ink3" align="center">
					v{Constants.expoConfig?.version ?? "—"}
				</Text>
			</View>
		</SettingsPage>
	);
}
