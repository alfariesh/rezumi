import { useLocalSearchParams } from "expo-router";
import { EmailSignInScreen } from "@/features/auth/email-sign-in-screen";

export default function EmailSignInRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <EmailSignInScreen email={email} />;
}
