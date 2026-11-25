import type { ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { Suspense, lazy, useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OpenCoach } from "./coach-actions";
import { SectionWidth, sidebarLayout } from "./section-width";
import { useIsTablet } from "./use-is-tablet";
import { Sheet, Spinner, cx } from "@/ui";

const Coach = lazy(() => import("@/features/assistant/coach").then(({ Coach }) => ({ default: Coach })));

const fill = { flex: 1 };

type CoachPanelProps = { children: ReactNode };

export function CoachPanel({ children }: CoachPanelProps) {
	const tablet = useIsTablet("window");
	const { width } = useWindowDimensions();
	const [sectionsWidth, setSectionsWidth] = useState<number | null>(null);
	const [open, setOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	useFocusEffect(useCallback(() => () => setOpen(false), []));
	const show = () => {
		setExpanded(false);
		setOpen(true);
	};
	const close = () => setOpen(false);
	const expand = { expanded, onPress: () => setExpanded(!expanded) };
	const sectionWidth =
		tablet && open && !expanded && sectionsWidth !== null ? sectionsWidth - sidebarLayout(width).width : null;
	const coach = open ? (
		<Suspense
			fallback={
				<View className="flex-1 items-center justify-center">
					<Spinner />
				</View>
			}
		>
			<Coach onClose={close} expand={expand} />
		</Suspense>
	) : null;

	return (
		<OpenCoach value={show}>
			<View className="flex-1 flex-row">
				<View
					className="flex-1"
					onLayout={(event) => setSectionsWidth(event.nativeEvent.layout.width)}
					accessibilityElementsHidden={tablet && open && expanded}
					importantForAccessibility={tablet && open && expanded ? "no-hide-descendants" : "auto"}
				>
					<SectionWidth value={sectionWidth}>{children}</SectionWidth>
				</View>
				{tablet ? (
					open ? (
						<View
							className={cx("border-s border-separator bg-surface", expanded ? "absolute inset-0" : "w-80 xl:w-96")}
						>
							<SafeAreaView edges={["top", "bottom"]} style={fill}>
								{coach}
							</SafeAreaView>
						</View>
					) : null
				) : (
					<Sheet
						isOpen={open}
						onOpenChange={(next) => {
							if (!next) close();
						}}
						detents={[0.82, 1]}
						detent={expanded ? 1 : 0}
						onDetentChange={(index) => setExpanded(index === 1)}
						scroll={false}
						padded={false}
						testID="coach-sheet"
					>
						{coach}
					</Sheet>
				)}
			</View>
		</OpenCoach>
	);
}
