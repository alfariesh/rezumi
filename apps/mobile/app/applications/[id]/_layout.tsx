import { Stack } from "expo-router";

/**
 * One application's workspace: a full-screen editor with its own bar (no drawer, no native header). The parts swap in
 * place, so they replace each other without animation.
 */
export default function ApplicationLayout() {
	return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}
