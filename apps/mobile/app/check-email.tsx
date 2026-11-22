import { useLocalSearchParams } from "expo-router";
import { CheckEmailScreen } from "@/features/auth/check-email-screen";

/** After Create account. Outside `(auth)`: the new account is already signed in. */
export default function CheckEmailRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <CheckEmailScreen email={email ?? ""} />;
}
