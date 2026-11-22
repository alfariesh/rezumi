// Sign in with email and password (01-desain 3). A wrong password, an unverified address, too many attempts and no
// network each get their own sentence (errors.ts). An account with two-step verification continues to the code screen.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { isEmailAddress } from "./email";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { useAuthAction } from "./use-auth-action";
import { useAuthServer } from "./use-auth-server";
import { signInWithEmail } from "@/auth/native-sign-in";
import { routes } from "@/routes";
import { Button, FieldError, Input, Label, LinkButton, TextField, type InputRef } from "@/ui";

type EmailSignInScreenProps = {
	/** Prefills the address, e.g. after Create account found an existing account. */
	email?: string | undefined;
};

export function EmailSignInScreen({ email: initialEmail = "" }: EmailSignInScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { server, flags } = useAuthServer();
	const [email, setEmail] = useState(initialEmail);
	const [password, setPassword] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const passwordRef = useRef<InputRef>(null);
	const { pending, error, run } = useAuthAction("sign-in");

	const emailInvalid = submitted && !isEmailAddress(email.trim());
	const passwordInvalid = submitted && password.length === 0;

	const submit = async () => {
		setSubmitted(true);
		if (!isEmailAddress(email.trim()) || password.length === 0) return;
		const result = await run(() => signInWithEmail(server, email.trim().toLowerCase(), password));
		// Signed in: the session gate leaves the auth screens by itself.
		if (result?.status === "two-factor") router.push(routes.twoFactor());
	};

	return (
		<AuthFrame
			title={t`Sign in`}
			description={t`Use the email and password of your Rezumi account.`}
			testID="email-sign-in"
		>
			<ErrorAlert message={error} />
			<View className="gap-4">
				<TextField isInvalid={emailInvalid} isRequired>
					<Label>{t`Email`}</Label>
					<Input
						value={email}
						onChangeText={setEmail}
						accessibilityLabel={t`Email`}
						placeholder={t`name@example.com`}
						keyboardType="email-address"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="email"
						textContentType="username"
						returnKeyType="next"
						submitBehavior="submit"
						onSubmitEditing={() => passwordRef.current?.focus()}
						testID="email"
					/>
					<FieldError>{t`Enter an email like name@example.com.`}</FieldError>
				</TextField>
				<TextField isInvalid={passwordInvalid} isRequired>
					<Label>{t`Password`}</Label>
					<Input
						ref={passwordRef}
						value={password}
						onChangeText={setPassword}
						accessibilityLabel={t`Password`}
						secureTextEntry
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="current-password"
						textContentType="password"
						returnKeyType="go"
						onSubmitEditing={() => void submit()}
						testID="password"
					/>
					<FieldError>{t`Enter your password.`}</FieldError>
				</TextField>
				<LinkButton className="self-end" onPress={() => router.push(routes.forgotPassword(email.trim()))}>
					<LinkButton.Label>{t`Forgot password?`}</LinkButton.Label>
				</LinkButton>
			</View>
			<Button size="lg" isDisabled={pending} onPress={() => void submit()} testID="sign-in-submit">
				<Button.Label>{pending ? t`Signing in…` : t`Sign in`}</Button.Label>
			</Button>
			{flags.data?.disableSignups ? null : (
				<Button variant="ghost" onPress={() => router.replace(routes.createAccount())}>
					<Button.Label>{t`New to Rezumi? Create an account`}</Button.Label>
				</Button>
			)}
		</AuthFrame>
	);
}
