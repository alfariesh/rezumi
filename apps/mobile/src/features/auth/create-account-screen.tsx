import type { PasswordStrength } from "./password-strength";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
// Create account (01-desain 3): name, email and a new password with a strength meter. The username is made from the
// email (usernameFromEmail) and can be changed later in Account; the person never has to invent one here. The account
// is signed in at once, as on the web, and the next screen asks them to confirm their email.
import { isEmailAddress } from "./email";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { passwordLimits, passwordStrength } from "./password-strength";
import { useAuthAction } from "./use-auth-action";
import { useAuthServer } from "./use-auth-server";
import { setAfterSignIn } from "@/auth/after-sign-in";
import { signUpWithEmail } from "@/auth/native-sign-in";
import { routes } from "@/routes";
import { Button, Description, FieldError, Input, Label, ProgressBar, Text, TextField, type InputRef } from "@/ui";

export function CreateAccountScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const { server, flags } = useAuthServer();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const emailRef = useRef<InputRef>(null);
	const passwordRef = useRef<InputRef>(null);
	const { pending, error, run, isRunning } = useAuthAction("sign-up");
	const strength = passwordStrength(password);

	const nameError = !name.trim()
		? t`Enter your name.`
		: name.trim().length > 64
			? t`Use 64 characters or fewer.`
			: null;
	const emailError = isEmailAddress(email.trim()) ? null : t`Enter an email like name@example.com.`;
	const passwordError =
		password.length < passwordLimits.min
			? t`Use at least ${passwordLimits.min} characters.`
			: password.length > passwordLimits.max
				? t`Use ${passwordLimits.max} characters or fewer.`
				: null;

	const submit = async () => {
		if (isRunning()) return;
		setSubmitted(true);
		if (nameError || emailError || passwordError) return;
		const address = email.trim().toLowerCase();
		// The session gate opens Check your email once the new account is signed in.
		setAfterSignIn(routes.checkEmail(address));
		const result = await run(() => signUpWithEmail(server, { name: name.trim(), email: address, password }));
		if (result?.status !== "signed-in") setAfterSignIn(null);
	};

	if (flags.data?.disableSignups) {
		return (
			<AuthFrame
				title={t`Create account`}
				description={t`New account sign-ups are turned off on this server. Sign in with an account you already have.`}
			>
				<Button size="lg" onPress={() => router.replace(routes.emailSignIn())}>
					<Button.Label>{t`Sign in`}</Button.Label>
				</Button>
			</AuthFrame>
		);
	}

	return (
		<AuthFrame
			title={t`Create account`}
			description={t`Free to start. You can add a photo, username and more later.`}
			testID="create-account"
		>
			<ErrorAlert message={error} />
			<View className="gap-4">
				<TextField isInvalid={submitted && !!nameError} isRequired>
					<Label>{t`Name`}</Label>
					<Input
						value={name}
						onChangeText={setName}
						accessibilityLabel={t`Name`}
						placeholder={t`Ana Putri`}
						autoComplete="name"
						textContentType="name"
						returnKeyType="next"
						submitBehavior="submit"
						onSubmitEditing={() => emailRef.current?.focus()}
						maxLength={64}
						testID="name"
					/>
					<FieldError>{nameError}</FieldError>
				</TextField>
				<TextField isInvalid={submitted && !!emailError} isRequired>
					<Label>{t`Email`}</Label>
					<Input
						ref={emailRef}
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
					<FieldError>{emailError}</FieldError>
				</TextField>
				<TextField isInvalid={submitted && !!passwordError} isRequired>
					<Label>{t`Password`}</Label>
					<Input
						ref={passwordRef}
						value={password}
						onChangeText={setPassword}
						accessibilityLabel={t`Password`}
						secureTextEntry
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="new-password"
						textContentType="newPassword"
						passwordRules={`minlength: ${passwordLimits.min}; maxlength: ${passwordLimits.max};`}
						returnKeyType="go"
						onSubmitEditing={() => void submit()}
						maxLength={passwordLimits.max}
						testID="password"
					/>
					{submitted && passwordError ? (
						<FieldError>{passwordError}</FieldError>
					) : (
						<Description>{t`At least ${passwordLimits.min} characters. A longer password is stronger.`}</Description>
					)}
				</TextField>
				<StrengthMeter strength={strength} />
			</View>
			<Button size="lg" isDisabled={pending} onPress={() => void submit()} testID="create-account-submit">
				<Button.Label>{pending ? t`Creating your account…` : t`Create account`}</Button.Label>
			</Button>
			<Button variant="ghost" onPress={() => router.replace(routes.emailSignIn())}>
				<Button.Label>{t`Already have an account? Sign in`}</Button.Label>
			</Button>
		</AuthFrame>
	);
}

type StrengthMeterProps = { strength: PasswordStrength };

function StrengthMeter({ strength }: StrengthMeterProps) {
	const { t } = useLingui();
	if (strength === "empty") return null;
	const level = {
		"too-short": { value: 15, label: t`Too short`, color: "danger" },
		weak: { value: 35, label: t`Weak`, color: "danger" },
		fair: { value: 65, label: t`Fair`, color: "warning" },
		strong: { value: 100, label: t`Strong`, color: "success" },
	} as const;
	const { value, label, color } = level[strength];
	return (
		<View className="gap-1.5">
			<ProgressBar value={value} accessibilityLabel={t`Password strength: ${label}`} color={color} />
			<Text size="xs" tone="muted">
				{t`Password strength: ${label}`}
			</Text>
		</View>
	);
}
