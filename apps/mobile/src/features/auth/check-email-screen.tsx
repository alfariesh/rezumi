// After Create account (01-desain 3): the account is already signed in, as on the web; this screen asks the person to
// confirm their address (publishing a portfolio, schedules and payments need it) and lets them resend the link or go on.
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ErrorAlert } from "./error-alert";
import { AuthFrame } from "./frame";
import { useAuthAction } from "./use-auth-action";
import { resendVerificationEmail } from "@/auth/native-sign-in";
import { getServer } from "@/auth/session";
import { routes } from "@/routes";
import { Button, Icon, Typography, showToast } from "@/ui";

type CheckEmailScreenProps = { email: string };

export function CheckEmailScreen({ email }: CheckEmailScreenProps) {
	const { t } = useLingui();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [sent, setSent] = useState(false);
	const { pending, error, run } = useAuthAction("sign-up");

	const resend = async () => {
		const done = await run(async () => {
			await resendVerificationEmail(getServer(), email);
			return true;
		});
		if (done) {
			setSent(true);
			showToast({ title: t`We sent a new link to ${email}.`, variant: "success" });
		}
	};

	const goOn = () => {
		void queryClient.invalidateQueries();
		router.replace(routes.home());
	};

	return (
		<AuthFrame
			title={t`Check your email`}
			description={t`We sent a link to ${email}. Open it on any device to confirm your address.`}
			back={false}
			testID="check-email"
		>
			<View className="items-center py-4">
				<View className="size-20 items-center justify-center rounded-full bg-accent-soft">
					<Icon name="envelope" size={24} tone="accent" />
				</View>
			</View>
			<Typography type="body-sm" className="text-muted">
				{t`You can start now. Publishing your portfolio, job alerts and payments wait until your email is confirmed. No email? Check spam, or send it again.`}
			</Typography>
			<ErrorAlert message={error} />
			<Button size="lg" onPress={goOn} testID="check-email-continue">
				<Button.Label>{t`Continue`}</Button.Label>
			</Button>
			<Button
				variant="secondary"
				isDisabled={pending || sent}
				onPress={() => void resend()}
				testID="check-email-resend"
			>
				<Button.Label>{sent ? t`Link sent` : pending ? t`Sending…` : t`Send the link again`}</Button.Label>
			</Button>
		</AuthFrame>
	);
}
