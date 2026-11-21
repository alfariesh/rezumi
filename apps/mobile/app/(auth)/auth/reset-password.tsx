import { useLocalSearchParams } from "expo-router";
import { ResetPasswordScreen } from "@/features/auth/reset-password-screen";

/** `/auth/reset-password?token=` from the reset email (an app link), or `?error=INVALID_TOKEN` from the server. */
export default function ResetPasswordRoute() {
	const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
	return <ResetPasswordScreen token={token} error={error} />;
}
