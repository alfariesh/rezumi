// Screen tests: the design-system providers of `renderUi`, plus Lingui (English, messages from the source) and a
// fresh QueryClient per render.
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react-native";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

i18n.loadAndActivate({ locale: "en", messages: {} });

const fill = { flex: 1 };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

export async function renderScreen(ui: ReactElement) {
	// No garbage collection: its five-minute timer would keep Jest from exiting after a screen writes to the cache.
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
			mutations: { gcTime: Number.POSITIVE_INFINITY },
		},
	});
	function Providers({ children }: { children: ReactNode }) {
		return (
			<GestureHandlerRootView style={fill}>
				<SafeAreaProvider initialMetrics={metrics}>
					<HeroUINativeProvider config={{ animation: "disable-all", devInfo: { stylingPrinciples: false } }}>
						<QueryClientProvider client={queryClient}>
							<I18nProvider i18n={i18n}>{children}</I18nProvider>
						</QueryClientProvider>
					</HeroUINativeProvider>
				</SafeAreaProvider>
			</GestureHandlerRootView>
		);
	}
	const result = await render(ui, { wrapper: Providers });
	return { queryClient, ...result };
}
