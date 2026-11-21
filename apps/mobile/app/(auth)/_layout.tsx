import { Stack } from "expo-router";
import { useReducedMotion } from "@/ui-legacy";

export default function AuthLayout() {
	const reduced = useReducedMotion();
	return <Stack screenOptions={{ headerShown: false, animation: reduced ? "fade" : "default" }} />;
}
