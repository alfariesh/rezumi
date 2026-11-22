import { Redirect } from "expo-router";
import { useSession } from "@/auth/session";
import { introSeen } from "@/features/onboarding/intro-seen";
import { routes } from "@/routes";

/** The launch route: the intro on a fresh install, then sign-in when signed out, so Home never renders first. */
export default function Index() {
	const { status } = useSession();
	// Expired stays on Home under the "Sign in again" sheet (SessionGate).
	if (status === "signed-in" || status === "expired") return <Redirect href={routes.home()} />;
	return <Redirect href={introSeen() ? routes.signIn() : routes.intro()} />;
}
