// The app's main navigation (01-desain 2): five bottom tabs on phones, the web's sidebar from 700 pt wide. Both read
// the tab routes of app/(tabs) and their options; a tab hidden with `href: null` (Portfolio without access) is skipped.
import type { AppTab } from "@/routes";
import type { IconName } from "@/ui";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useLingui } from "@lingui/react/macro";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountButton } from "./account-menu";
import { useUnreadCount, useSidebarCounts } from "@/features/home/queries";
import { routes } from "@/routes";
import { Button, Icon, Text, cx, haptics, setToastBarHeight, useThemeColor } from "@/ui";
import { useKeyboardVisible } from "@/ui/keyboard";

const tabIcons: Record<AppTab, IconName> = {
	home: "house",
	documents: "file-text",
	applications: "briefcase",
	portfolio: "globe-hemisphere-west",
	profile: "user-circle",
};

/** The web sidebar's order (owner, 2026-11-16): Home, Portfolio, Documents, Profile, Applications. */
const sidebarOrder: readonly AppTab[] = ["home", "portfolio", "documents", "profile", "applications"];

/** Below this width the sidebar is a rail of icons with short labels. */
const fullSidebarWidth = 1000;

type TabRoute = BottomTabBarProps["state"]["routes"][number];

function isAppTab(name: string): name is AppTab {
	return name in tabIcons;
}

function useTabLabels(): Record<AppTab, string> {
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
function useTabs({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
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

type BadgeProps = { count: number | undefined };

/** Unread count on the Home tab; nothing at zero, "99+" above it. */
function Badge({ count }: BadgeProps) {
	if (!count) return null;
	return (
		<View className="absolute -end-3 -top-1 h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1">
			<Text size="xs" weight="semibold" className="text-accent-foreground" tabular>
				{count > 99 ? "99+" : String(count)}
			</Text>
		</View>
	);
}

/**
 * The phone tab bar: a bar on `surface` with a hairline on top, the selected tab in accent with its duotone glyph,
 * the Home badge for unread notifications. Hidden while the keyboard is up. While it shows (the tabs are the screen in
 * front), toasts sit above it.
 */
export function PhoneTabBar(props: BottomTabBarProps) {
	const { t } = useLingui();
	const labels = useTabLabels();
	const unread = useUnreadCount();
	const insets = useSafeAreaInsets();
	const keyboard = useKeyboardVisible();
	const ripple = useThemeColor("default");
	const { visible, focusedKey, press } = useTabs(props);
	// False while a screen is pushed or presented over the tabs: the bar is then covered and toasts drop to the bottom.
	const front = useIsFocused();
	const height = useRef(0);
	const showing = front && !keyboard;
	useEffect(() => setToastBarHeight("tabs", showing ? height.current : 0), [showing]);
	useEffect(() => () => setToastBarHeight("tabs", 0), []);
	if (keyboard) return null;
	const frame = { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right };

	return (
		<View
			accessibilityRole="tablist"
			className="flex-row border-t border-separator bg-surface"
			style={frame}
			testID="phone-tab-bar"
			onLayout={(event) => {
				height.current = event.nativeEvent.layout.height;
				if (showing) setToastBarHeight("tabs", height.current);
			}}
		>
			{visible.map((route) => {
				const name = route.name as AppTab;
				const label = labels[name];
				const focused = route.key === focusedKey;
				const count = name === "home" ? unread : undefined;
				return (
					<Pressable
						key={route.key}
						accessibilityRole="tab"
						accessibilityState={{ selected: focused }}
						accessibilityLabel={count ? t`${label}, ${count} unread` : label}
						android_ripple={Platform.OS === "android" ? { color: ripple, borderless: true } : undefined}
						onPress={() => press(route)}
						testID={`tab-${name}`}
						className="min-h-14 flex-1 items-center justify-center gap-0.5 px-1 pt-1.5 pb-1"
					>
						<View>
							<Icon
								name={tabIcons[name]}
								size={24}
								variant={focused ? "duotone" : "stroke"}
								tone={focused ? "accent" : "muted"}
							/>
							<Badge count={count} />
						</View>
						<Text
							size="xs"
							weight="medium"
							tone={focused ? "accent" : "muted"}
							numberOfLines={1}
							adjustsFontSizeToFit
							minimumFontScale={0.8}
							maxFontSizeMultiplier={1.3}
						>
							{labels[name]}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
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
	const { visible, focusedKey, press } = useTabs(props);
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
