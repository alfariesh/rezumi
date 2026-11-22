import type { AppTab } from "@/routes";
import type { IconName } from "@/ui";
// The phone's main navigation (01-desain 2): a menu behind the screen, opened from the avatar at the start of every
// section's top bar or by a swipe from the edge, in place of a bottom tab bar. It holds the account, the five sections
// in the web sidebar's order with their counts, New, the account pages, the appearance and Sign out. Tablets keep the
// sidebar (app-tabs.tsx).
import type { BottomTabBarProps } from "expo-router/tabs";
import { useLingui } from "@lingui/react/macro";
import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { AccountAvatar, useAccountLinks, useSignOutConfirm } from "./account-menu";
import { readTabs, sidebarOrder, tabIcons, useTabLabels } from "./app-tabs";
import { useSidebarCounts, useUnreadCount } from "@/features/home/queries";
import { useProfile } from "@/features/settings/queries";
import { routes } from "@/routes";
import { Button, Icon, IconButton, Separator, Text, cx, setThemePreference, useColorSchemeValue } from "@/ui";

type DrawerState = {
	open: boolean;
	/** The tab navigator's state and actions, handed over by `PhoneTabBridge` (the drawer sits outside it). */
	tabs: BottomTabBarProps | null;
};

const useDrawerStore = create<DrawerState>(() => ({ open: false, tabs: null }));

export const setAppDrawerOpen = (open: boolean) => useDrawerStore.setState({ open });
export const useAppDrawerOpen = () => useDrawerStore((state) => state.open);

/** The sections' top screens: only there does a swipe from the edge open the drawer (deeper, it means Back). */
const sectionRoots = new Set(["/home", "/documents", "/applications", "/portfolio", "/profile"]);

export function useDrawerEdgeSwipe() {
	return sectionRoots.has(usePathname());
}

/** Closes the drawer whenever the screen changes underneath it (a link, a notification, Back). */
export function useCloseDrawerOnNavigate() {
	const pathname = usePathname();
	useEffect(() => setAppDrawerOpen(false), [pathname]);
}

/**
 * The phone's tab bar slot: draws nothing and hands the tab navigator to the drawer, so a section keeps its own stack
 * and pressing the open section pops it to the top, as a tab bar would.
 */
export function PhoneTabBridge(props: BottomTabBarProps) {
	useEffect(() => useDrawerStore.setState({ tabs: props }), [props]);
	useEffect(() => () => useDrawerStore.setState({ tabs: null }), []);
	return null;
}

/** The avatar at the start of a section's top bar: opens the drawer; a dot when notifications are unread. */
export function DrawerButton() {
	const { t } = useLingui();
	const unread = useUnreadCount();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={unread ? t`Open menu, ${unread} unread` : t`Open menu`}
			hitSlop={4}
			onPress={() => setAppDrawerOpen(true)}
			testID="open-drawer"
			className="-ms-1 min-h-11 min-w-11 items-center justify-center"
		>
			<AccountAvatar />
			{unread ? (
				<View className="absolute end-0 top-1.5 size-3 rounded-full border-2 border-background bg-accent" />
			) : null}
		</Pressable>
	);
}

type DrawerRowProps = {
	icon: IconName;
	label: string;
	selected?: boolean | undefined;
	/** A count beside the label: an accent pill when unread, otherwise a quiet number. */
	count?: number | undefined;
	unread?: boolean | undefined;
	/** Sections are tabs to a screen reader; account pages are links. */
	role?: "tab" | "link" | undefined;
	large?: boolean | undefined;
	onPress: () => void;
	testID?: string | undefined;
};

function DrawerRow({
	icon,
	label,
	selected = false,
	count,
	unread = false,
	role = "link",
	large = false,
	onPress,
	testID,
}: DrawerRowProps) {
	const { t } = useLingui();
	const shown = count ? (count > 99 ? "99+" : String(count)) : null;
	return (
		<Pressable
			accessibilityRole={role}
			accessibilityState={role === "tab" ? { selected } : undefined}
			accessibilityLabel={shown ? (unread ? t`${label}, ${shown} unread` : `${label}, ${shown}`) : label}
			onPress={onPress}
			testID={testID}
			className={cx(
				"flex-row items-center gap-4 rounded-xl px-3 active:bg-default",
				large ? "min-h-12" : "min-h-11",
				selected && "bg-accent-soft",
			)}
		>
			<Icon
				name={icon}
				size={large ? 24 : 20}
				variant={selected ? "duotone" : "stroke"}
				tone={selected ? "accent" : "muted"}
			/>
			<Text
				size={large ? "base" : "sm"}
				weight={selected ? "semibold" : "medium"}
				tone={selected ? "accent" : large ? "default" : "muted"}
				numberOfLines={1}
				className="flex-1"
			>
				{label}
			</Text>
			{shown ? (
				unread ? (
					<View className="min-w-5 items-center rounded-full bg-accent px-1.5">
						<Text size="xs" weight="semibold" className="text-accent-foreground" tabular>
							{shown}
						</Text>
					</View>
				) : (
					<Text size="xs" tone="muted" tabular>
						{shown}
					</Text>
				)
			) : null}
		</Pressable>
	);
}

/** What the drawer shows behind the screen. */
export function AppDrawerMenu() {
	const { t } = useLingui();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const labels = useTabLabels();
	const unread = useUnreadCount();
	const counts = useSidebarCounts();
	const profile = useProfile();
	const links = useAccountLinks();
	const signOut = useSignOutConfirm();
	const scheme = useColorSchemeValue();
	const tabs = useDrawerStore((state) => state.tabs);
	const sections = tabs ? readTabs(tabs) : null;
	const ordered = sections
		? sidebarOrder.flatMap((name) => sections.visible.filter((route) => route.name === name))
		: [];
	const countOf: Partial<Record<AppTab, number | undefined>> = {
		home: unread,
		documents: counts.documents,
		applications: counts.applications,
	};
	const name = profile.data?.name ?? "";
	const email = profile.data?.email ?? "";

	const close = () => setAppDrawerOpen(false);
	const open = (go: () => void) => {
		close();
		go();
	};
	const frame = {
		paddingTop: insets.top + 8,
		paddingBottom: insets.bottom + 8,
		paddingStart: insets.left + 12,
		paddingEnd: 12,
	};

	return (
		<View className="flex-1 bg-surface" style={frame} testID="app-drawer">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={name ? t`${name}, open Profile` : t`Open Profile`}
				onPress={() => {
					const profileTab = sections?.visible.find((route) => route.name === "profile");
					open(() => (profileTab && sections ? sections.press(profileTab) : router.navigate(routes.profile())));
				}}
				className="gap-3 rounded-xl px-3 pt-2 pb-4"
				testID="drawer-profile-card"
			>
				<AccountAvatar size="lg" />
				<View className="gap-0.5">
					<Text size="base" weight="semibold" numberOfLines={1}>
						{name || t`Account`}
					</Text>
					{email ? (
						<Text size="sm" tone="muted" numberOfLines={1}>
							{email}
						</Text>
					) : null}
				</View>
			</Pressable>
			<Separator />
			<ScrollView
				accessibilityRole="tablist"
				contentContainerClassName="gap-1 py-3"
				showsVerticalScrollIndicator={false}
			>
				{ordered.map((route) => {
					const tab = route.name as AppTab;
					return (
						<DrawerRow
							key={route.key}
							icon={tabIcons[tab]}
							label={labels[tab]}
							role="tab"
							large
							selected={route.key === sections?.focusedKey}
							count={countOf[tab]}
							unread={tab === "home"}
							onPress={() => open(() => sections?.press(route))}
							testID={`drawer-${tab}`}
						/>
					);
				})}
				<View className="px-1 py-3">
					<Button variant="primary" onPress={() => open(() => router.push(routes.new()))} testID="drawer-new">
						<Icon name="plus" size={20} tone="accent-foreground" />
						<Button.Label>{t`New`}</Button.Label>
					</Button>
				</View>
				<Separator className="mb-2" />
				{links.map((link) => (
					<DrawerRow
						key={link.id}
						icon={link.icon}
						label={link.label}
						onPress={() => open(() => router.push(link.href))}
						testID={`drawer-link-${link.id}`}
					/>
				))}
			</ScrollView>
			<View className="flex-row items-center justify-between border-t border-separator pt-2">
				<Button variant="ghost" isDisabled={signOut.disabled} onPress={signOut.ask} testID="drawer-sign-out">
					<Icon name="sign-out" size={20} tone="danger" />
					<Button.Label className="text-danger">{t`Sign out`}</Button.Label>
				</Button>
				<IconButton
					icon={scheme === "dark" ? "sun" : "moon"}
					label={scheme === "dark" ? t`Use light appearance` : t`Use dark appearance`}
					onPress={() => setThemePreference(scheme === "dark" ? "light" : "dark")}
					testID="drawer-appearance"
				/>
			</View>
			{signOut.dialog}
		</View>
	);
}
