// Component tests render inside the same providers as the app (HeroUI, safe area), with animations off.
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react-native";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

const fill = { flex: 1 };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function Providers({ children }: { children: ReactNode }) {
	return (
		<GestureHandlerRootView style={fill}>
			<SafeAreaProvider initialMetrics={metrics}>
				<HeroUINativeProvider config={{ animation: "disable-all", devInfo: { stylingPrinciples: false } }}>
					{children}
				</HeroUINativeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

export function renderUi(ui: ReactElement) {
	return render(ui, { wrapper: Providers });
}
