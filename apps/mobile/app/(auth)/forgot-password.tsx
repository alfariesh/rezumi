import { useLocalSearchParams } from "expo-router";
import { ForgotPasswordScreen } from "@/features/auth/forgot-password-screen";

export default function ForgotPasswordRoute() {
	const { email } = useLocalSearchParams<{ email?: string }>();
	return <ForgotPasswordScreen email={email} />;
}
