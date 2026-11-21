// Dev-only gallery of the design system (src/ui), for design review and the phase screenshots. Not a product screen:
// its sample copy is not translated, and production builds redirect home.
//
// Deep link: `app.rezumi://dev/ui?group=fields` (foundation, fields, feedback, overlays, navigation, data).
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { DataGallery } from "@/dev/gallery/data";
import { FeedbackGallery } from "@/dev/gallery/feedback";
import { FieldsGallery } from "@/dev/gallery/fields";
import { FoundationGallery } from "@/dev/gallery/foundation";
import { NavigationGallery } from "@/dev/gallery/navigation";
import { OverlaysGallery } from "@/dev/gallery/overlays";
import { Button, Screen, setThemePreference, useColorSchemeValue } from "@/ui";

const groups = {
	foundation: { label: "Foundation", Gallery: FoundationGallery },
	fields: { label: "Fields", Gallery: FieldsGallery },
	feedback: { label: "Feedback", Gallery: FeedbackGallery },
	overlays: { label: "Overlays", Gallery: OverlaysGallery },
	navigation: { label: "Navigation", Gallery: NavigationGallery },
	data: { label: "Data", Gallery: DataGallery },
} as const;

type Group = keyof typeof groups;

function Gallery() {
	const params = useLocalSearchParams<{ group?: string }>();
	const router = useRouter();
	const scheme = useColorSchemeValue();
	const group: Group = params.group && params.group in groups ? (params.group as Group) : "foundation";
	const { Gallery: Current } = groups[group];
	return (
		<>
			<Stack.Screen
				options={{
					title: "UI kit",
					headerRight: () => (
						<Button size="sm" variant="ghost" onPress={() => setThemePreference(scheme === "dark" ? "light" : "dark")}>
							{scheme === "dark" ? "Light" : "Dark"}
						</Button>
					),
				}}
			/>
			<Screen>
				<ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 grow-0">
					<View className="flex-row gap-2 px-4">
						{(Object.keys(groups) as Group[]).map((key) => (
							<Button
								key={key}
								size="sm"
								variant={key === group ? "primary" : "secondary"}
								onPress={() => router.setParams({ group: key })}
								accessibilityState={{ selected: key === group }}
							>
								{groups[key].label}
							</Button>
						))}
					</View>
				</ScrollView>
				<View className="pb-24">
					<Current />
				</View>
			</Screen>
		</>
	);
}

export default function DevUiRoute() {
	if (!__DEV__) return <Redirect href="/" />;
	return <Gallery />;
}
