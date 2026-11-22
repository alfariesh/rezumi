// The sections of app/(tabs) (01-desain 2): the web's sidebar from 700 pt wide, and the names, icons and press
// semantics the phone drawer (app-drawer.tsx) shares with it. A tab hidden with `href: null` (Portfolio without
// access) is skipped.
import type { AppTab } from "@/routes";
import type { IconName } from "@/ui";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountButton } from "./account-menu";
import { useUnreadCount, useSidebarCounts } from "@/features/home/queries";
import { routes } from "@/routes";
import { Button, Icon, Text, cx, haptics } from "@/ui";

export const tabIcons: Record<AppTab, IconName> = {
	home: "house",
	documents: "file-text",
	applications: "briefcase",
	portfolio: "globe-hemisphere-west",
	profile: "user-circle",
};

/** The web sidebar's order (owner, 2026-11-16): Home, Portfolio, Documents, Profile, Applications. */
export const sidebarOrder: readonly AppTab[] = ["home", "portfolio", "documents", "profile", "applications"];

/** Below this width the sidebar is a rail of icons with short labels. */
const fullSidebarWidth = 1000;

type TabRoute = BottomTabBarProps["state"]["routes"][number];

function isAppTab(name: string): name is AppTab {
	return name in tabIcons;
}

export function useTabLabels(): Record<AppTab, string> {
	const { t } = useLingui();
	return {
		home: t`Home`,
		documents: t`Documents`,
		applications: t`Applications`,
		portfolio: t`Portfolio`,
		profile: t`Profile`,
	};
}

/** Visible tab routes, with React Navigation's press semantics: a focused tab's press goes to the tab (pop to top). */
export function readTabs({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
	const focusedKey = state.routes[state.index]?.key;
	const visible = state.routes.filter((route) => {
		const options = descriptors[route.key]?.options as { hidden?: boolean } | undefined;
		return isAppTab(route.name) && !options?.hidden;
	});
	const press = (route: TabRoute) => {
		const focused = route.key === focusedKey;
		const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
		if (!focused && !event.defaultPrevented) {
			haptics.selection();
			navigateToTab(route.key);
		}
	};
	return { visible, focusedKey, press };
}

type SidebarItemProps = {
	icon: IconName;
	label: string;
	selected: boolean;
	count?: number | undefined;
	/** Unread (Home): an accent pill. Otherwise a quiet number, as on the web. */
	unread?: boolean | undefined;
	compact: boolean;
	onPress: () => void;
	testID?: string | undefined;
};

function SidebarItem({ icon, label, selected, count, unread = false, compact, onPress, testID }: SidebarItemProps) {
	const { t } = useLingui();
	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityState={{ selected }}
			accessibilityLabel={count ? (unread ? t`${label}, ${count} unread` : `${label}, ${count}`) : label}
			onPress={onPress}
			testID={testID}
			className={cx(
				"min-h-11 items-center rounded-xl",
				compact ? "gap-0.5 px-1 py-2" : "flex-row gap-3 px-3",
				selected && "bg-accent-soft",
			)}
		>
			<Icon
				name={icon}
				size={compact ? 24 : 20}
				variant={selected ? "duotone" : "stroke"}
				tone={selected ? "accent" : "muted"}
			/>
			<Text
				size={compact ? "xs" : "sm"}
				weight={selected ? "semibold" : "medium"}
				tone={selected ? "accent" : "muted"}
				numberOfLines={1}
				className={compact ? "text-center" : "flex-1"}
			>
				{label}
			</Text>
			{!compact && count ? (
				unread ? (
					<View className="min-w-5 items-center rounded-full bg-accent px-1.5">
						<Text size="xs" weight="semibold" className="text-accent-foreground" tabular>
							{count > 99 ? "99+" : String(count)}
						</Text>
					</View>
				) : (
					<Text size="xs" tone="muted" tabular>
						{String(count)}
					</Text>
				)
			) : null}
		</Pressable>
	);
}

/**
 * The sidebar from 700 pt wide (iPad, foldables, landscape tablets): the brand, the sections in the web's order with
 * their counts, then New and the account at the foot. Under 1000 pt it is a rail of icons with short labels.
 */
export function AppSidebar(props: BottomTabBarProps) {
	const { t } = useLingui();
	const router = useRouter();
	const labels = useTabLabels();
	const unread = useUnreadCount();
	const counts = useSidebarCounts();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const compact = width < fullSidebarWidth;
	const { visible, focusedKey, press } = readTabs(props);
	const ordered = sidebarOrder.flatMap((name) => visible.filter((route) => route.name === name));
	const countOf: Partial<Record<AppTab, number | undefined>> = {
		home: unread,
		documents: counts.documents,
		applications: counts.applications,
	};
	const frame = {
		paddingTop: insets.top + 12,
		paddingBottom: insets.bottom + 12,
		paddingStart: insets.left + 12,
	};

	return (
		<View
			accessibilityRole="tablist"
			className={cx("border-e border-separator bg-surface pe-3", compact ? "w-24" : "w-64")}
			style={frame}
		>
			<Text
				weight="bold"
				size="base"
				accessibilityRole="header"
				numberOfLines={1}
				className={cx("pb-4", compact ? "text-center" : "px-3")}
			>
				Rezumi
			</Text>
			<ScrollView contentContainerClassName="grow gap-1" showsVerticalScrollIndicator={false}>
				{ordered.map((route) => {
					const name = route.name as AppTab;
					return (
						<SidebarItem
							key={route.key}
							icon={tabIcons[name]}
							label={labels[name]}
							selected={route.key === focusedKey}
							count={countOf[name]}
							unread={name === "home"}
							compact={compact}
							onPress={() => press(route)}
							testID={`sidebar-${name}`}
						/>
					);
				})}
				<View className="flex-1" />
				<View className="gap-2 pt-2">
					{compact ? (
						<Button isIconOnly variant="primary" accessibilityLabel={t`New`} onPress={() => router.push(routes.new())}>
							<Icon name="plus" size={20} tone="accent-foreground" />
						</Button>
					) : (
						<Button variant="primary" onPress={() => router.push(routes.new())}>
							<Icon name="plus" size={20} tone="accent-foreground" />
							<Button.Label>{t`New`}</Button.Label>
						</Button>
					)}
					<View className={cx("border-t border-separator pt-2", compact && "items-center")}>
						<AccountButton showName={!compact} />
					</View>
				</View>
			</ScrollView>
		</View>
	);
}
