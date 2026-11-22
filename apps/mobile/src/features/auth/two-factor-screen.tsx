// Two-step verification (01-desain 3): the 6-digit code from the authenticator app, or a backup code. The pending
// sign-in lives 10 minutes in memory; after that the person starts again (a new sign-in replaces it).
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { useAuthAction } from "./use-auth-action";
import { hasPendingTwoFactor, verifyTwoFactor } from "@/auth/native-sign-in";
import { routes } from "@/routes";
import { Button, Description, Input, InputOTP, Label, TextField } from "@/ui";

export function TwoFactorScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const [mode, setMode] = useState<"totp" | "backup">("totp");
	const [code, setCode] = useState("");
	// The pending sign-in is gone (it expired, or the code was accepted but the connection failed afterwards): another
	// code can't help, so the screen offers to start again instead of Verify.
	const [ended, setEnded] = useState(false);
	const { pending, error, run } = useAuthAction("two-factor");

	// Opened without a pending sign-in (expired, or restored from a link): start again.
	useEffect(() => {
		if (!hasPendingTwoFactor()) router.replace(routes.emailSignIn());
	}, [router]);

	const submit = async (value = code) => {
		if (mode === "totp" ? value.length !== 6 : value.trim().length < 6) return;
		const result = await run(() => verifyTwoFactor(value, mode));
		if (result) return;
		setCode("");
		if (!hasPendingTwoFactor()) setEnded(true);
	};

	const switchMode = () => {
		setMode(mode === "totp" ? "backup" : "totp");
		setCode("");
	};

	return (
		<AuthFrame
			title={t`Two-step verification`}
			description={
				mode === "totp"
					? t`Enter the 6-digit code from your authenticator app.`
					: t`Enter one of the backup codes you saved when you turned on two-step verification. Each works once.`
			}
			testID="two-factor"
		>
			<ErrorAlert message={error} />
			{mode === "totp" ? (
				<View className="items-center">
					<InputOTP
						maxLength={6}
						value={code}
						onChange={setCode}
						onComplete={(value) => void submit(value)}
						inputMode="numeric"
						isDisabled={pending}
						isInvalid={!!error}
						textInputProps={{ autoComplete: "one-time-code", textContentType: "oneTimeCode", autoFocus: true }}
					>
						<InputOTP.Group>
							<InputOTP.Slot index={0} />
							<InputOTP.Slot index={1} />
							<InputOTP.Slot index={2} />
						</InputOTP.Group>
						<InputOTP.Separator />
						<InputOTP.Group>
							<InputOTP.Slot index={3} />
							<InputOTP.Slot index={4} />
							<InputOTP.Slot index={5} />
						</InputOTP.Group>
					</InputOTP>
				</View>
			) : (
				<TextField>
					<Label>{t`Backup code`}</Label>
					<Input
						value={code}
						onChangeText={setCode}
						accessibilityLabel={t`Backup code`}
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="one-time-code"
						autoFocus
						returnKeyType="go"
						onSubmitEditing={() => void submit()}
						testID="backup-code"
					/>
					<Description>{t`Codes look like a1b2c-d3e4f.`}</Description>
				</TextField>
			)}
			{ended ? (
				<Button size="lg" onPress={() => router.replace(routes.emailSignIn())} testID="two-factor-restart">
					<Button.Label>{t`Sign in again`}</Button.Label>
				</Button>
			) : (
				<>
					<Button size="lg" isDisabled={pending} onPress={() => void submit()} testID="two-factor-submit">
						<Button.Label>{pending ? t`Checking…` : t`Verify`}</Button.Label>
					</Button>
					<Button variant="ghost" isDisabled={pending} onPress={switchMode}>
						<Button.Label>{mode === "totp" ? t`Use a backup code instead` : t`Use the authenticator app`}</Button.Label>
					</Button>
				</>
			)}
		</AuthFrame>
	);
}
