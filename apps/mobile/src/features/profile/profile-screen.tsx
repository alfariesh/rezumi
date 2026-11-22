// The Profile tab (plans/mobile Phase 06): the one place a person's details and career are kept, which resumes,
// letters, the portfolio and the AI start from. A scrollable row of sections under the title, as the web's section
// menu: Details · Career · Facts · Stories · Preferences. Each section owns its scrolling.
import type { ProfileTab } from "@/routes";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { CareerPanel } from "./career";
import { ProfileConflictSheet } from "./conflict-sheet";
import { DetailsPanel } from "./details";
import { FactsPanel } from "./facts";
import { PreferencesPanel } from "./preferences";
import { StoriesPanel } from "./stories";
import { PROFILE_TABS } from "@/routes";
import { TabTopBar } from "@/shell/tab-chrome";
import { Tabs, haptics } from "@/ui";

type ProfileScreenProps = { tab?: string | undefined };

const isTab = (value: string | undefined): value is ProfileTab =>
	value !== undefined && (PROFILE_TABS as readonly string[]).includes(value);

export function ProfileScreen({ tab }: ProfileScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const current: ProfileTab = isTab(tab) ? tab : "details";
	const labels: Record<ProfileTab, string> = {
		details: t`Details`,
		career: t`Career`,
		facts: t`Facts`,
		stories: t`Stories`,
		preferences: t`Preferences`,
	};

	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Profile`} />
			<Tabs
				value={current}
				onValueChange={(next) => {
					if (!isTab(next) || next === current) return;
					haptics.selection();
					router.setParams({ tab: next === "details" ? undefined : next });
				}}
				variant="secondary"
				className="flex-1"
			>
				<Tabs.List className="mx-4" accessibilityLabel={t`Profile sections`}>
					<Tabs.ScrollView scrollAlign="start">
						<Tabs.Indicator />
						{PROFILE_TABS.map((value) => (
							<Tabs.Trigger key={value} value={value} testID={`profile-tab-${value}`}>
								<Tabs.Label>{labels[value]}</Tabs.Label>
							</Tabs.Trigger>
						))}
					</Tabs.ScrollView>
				</Tabs.List>
				<View className="flex-1">
					{current === "details" ? <DetailsPanel /> : null}
					{current === "career" ? <CareerPanel /> : null}
					{current === "facts" ? <FactsPanel /> : null}
					{current === "stories" ? <StoriesPanel /> : null}
					{current === "preferences" ? <PreferencesPanel /> : null}
				</View>
			</Tabs>
			<ProfileConflictSheet />
		</View>
	);
}
