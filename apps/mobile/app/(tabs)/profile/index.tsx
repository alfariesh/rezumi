import { useLocalSearchParams } from "expo-router";
import { ProfileScreen } from "@/features/profile/profile-screen";

/** `?tab=` opens a section (career, facts, stories, preferences); links from the web's Profile pages land here. */
export default function ProfileRoute() {
	const { tab } = useLocalSearchParams<{ tab?: string }>();
	return <ProfileScreen tab={typeof tab === "string" ? tab : undefined} />;
}
