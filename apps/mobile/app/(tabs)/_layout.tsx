import { useLingui } from "@lingui/react/macro";
import { useNetworkState } from "expo-network";
import { useRouter } from "expo-router";
import { Tabs } from "expo-router/tabs";
import { Easing, View } from "react-native";
import {
	SafeAreaInsetsContext,
	SafeAreaProvider,
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { usePortfolioEnabled } from "@/features/home/queries";
import { routes } from "@/routes";
import { BannerAbove } from "@/shell/app-banner";
import { AppSidebar, PhoneTabBar } from "@/shell/app-tabs";
import { useKeyCommands } from "@/shell/key-commands";
import { OfflineStrip } from "@/shell/offline-strip";
import { InTabs } from "@/shell/tab-chrome";
import { useIsTablet } from "@/shell/use-is-tablet";
import { motion, useReducedMotion } from "@/ui";
import { KeyboardFrame } from "@/ui/keyboard";

// Third-party views (keyboard controller, safe area) take no className.
const fill = { flex: 1 };
// React Navigation animates with React Native's Animated, which needs its own easing (tokens.motion's is a worklet).
const tabEase = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Five tabs (01-desain 2): Home, Documents, Applications, Portfolio (only for accounts with portfolios), Profile. The
 * bottom bar on phones, the sidebar from 700 pt. The offline strip sits under the status bar above every tab, and
 * screens end at the top of the keyboard.
 */
export default function TabsLayout() {
	const router = useRouter();
	const { t } = useLingui();
	const tablet = useIsTablet();
	const insets = useSafeAreaInsets();
	const network = useNetworkState();
	const offline = network.isConnected === false || network.isInternetReachable === false;
	const portfolio = usePortfolioEnabled();
	const reduced = useReducedMotion();
	useKeyCommands(
		[
			{ id: "search", input: "k", title: t`Search`, run: () => router.push(routes.search()) },
			{ id: "new", input: "n", title: t`New`, run: () => router.push(routes.new()) },
		],
		"global",
	);
	const stripFrame = { paddingTop: insets.top, paddingStart: insets.left, paddingEnd: insets.right };

	return (
		<View className="flex-1 bg-background">
			{offline ? (
				<View style={stripFrame}>
					<OfflineStrip />
				</View>
			) : null}
			{/* Under the strip the status bar is already cleared, so the tabs must not pad it again. */}
			<SafeAreaInsetsContext value={offline ? { ...insets, top: 0 } : insets}>
				<BannerAbove value={offline}>
					<InTabs value>
						<KeyboardFrame behavior="padding" automaticOffset style={fill}>
							<SafeAreaView edges={["left", "right"]} style={fill}>
								<SafeAreaProvider>
									<Tabs
										tabBar={(props) => (tablet ? <AppSidebar {...props} /> : <PhoneTabBar {...props} />)}
										screenOptions={{
											animation: "fade",
											transitionSpec: {
												animation: "timing",
												config: { duration: reduced ? 0 : motion.quick, easing: tabEase },
											},
											headerShown: false,
											tabBarPosition: tablet ? "left" : "bottom",
										}}
									>
										<Tabs.Screen name="home" options={{ title: t`Home` }} />
										<Tabs.Screen name="documents" options={{ title: t`Documents` }} />
										<Tabs.Screen name="applications" options={{ title: t`Applications` }} />
										<Tabs.Screen
											name="portfolio"
											options={{ title: t`Portfolio`, ...(portfolio ? {} : { href: null }) }}
										/>
										<Tabs.Screen name="profile" options={{ title: t`Profile` }} />
									</Tabs>
								</SafeAreaProvider>
							</SafeAreaView>
						</KeyboardFrame>
					</InTabs>
				</BannerAbove>
			</SafeAreaInsetsContext>
		</View>
	);
}
