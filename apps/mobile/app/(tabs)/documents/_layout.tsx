import { Stack } from "expo-router";

/** The library draws its own top bar (`TabTopBar`), like Home. */
export default function DocumentsLayout() {
	return <Stack screenOptions={{ headerShown: false }} />;
}
