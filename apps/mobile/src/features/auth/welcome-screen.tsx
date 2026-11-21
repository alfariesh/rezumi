// Welcome (01-desain 3, K4): Continue with Apple (where the device offers it), Google, email, Create account, and the
// other ways (GitHub, LinkedIn, passkey, a custom provider) in an in-app browser sheet. Guests when the server allows
// them. Development builds add the Server row; people never see it.
import type { IdTokenSignIn } from "@/auth/native-sign-in";
import { useLingui } from "@lingui/react/macro";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { LEGAL_URLS } from "@rezumi/schema/billing";
import { ErrorAlert } from "./error-alert";
import { useAuthAction } from "./use-auth-action";
import { useAuthServer } from "./use-auth-server";
import { getAppleIdToken } from "@/auth/apple";
import { canUseGoogle, getGoogleIdToken } from "@/auth/google";
import { signInAsGuest, signInWithIdToken } from "@/auth/native-sign-in";
import { signIn } from "@/auth/session";
import { routes } from "@/routes";
import {
	AppleSignInButton,
	Button,
	Icon,
	LinkButton,
	ListRow,
	ListSection,
	Screen,
	Sheet,
	Skeleton,
	Text,
	Typography,
	showToast,
} from "@/ui";

type Busy = "apple" | "google" | "guest" | "browser" | null;

// expo-image takes no className: the app mark is 80 pt with the icon's own rounding (radius 2xl).
const appMark = { width: 80, height: 80, borderRadius: 16 };

export function WelcomeScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const { server, flags, options } = useAuthServer();
	const { error, setError, run } = useAuthAction("social");
	const [busy, setBusy] = useState<Busy>(null);
	const [moreOpen, setMoreOpen] = useState(false);

	const providers = options.data?.providers ?? {};
	const native = options.data?.native;
	const emailAuth = !flags.data?.disableEmailAuth;
	const signUps = !flags.data?.disableSignups;
	const google = canUseGoogle(native?.google) ? native?.google : null;
	const browserProviders = (
		[
			["github", "github-logo", t`GitHub`],
			["linkedin", "linkedin-logo", t`LinkedIn`],
			["passkey", "fingerprint", t`Passkey`],
			["custom", "key", providers.custom ?? t`Single sign-on`],
		] as const
	).filter(([id]) => id in providers);

	const withBusy = async (which: Exclude<Busy, null>, action: () => Promise<unknown>) => {
		setBusy(which);
		try {
			await run(action);
		} finally {
			setBusy(null);
		}
	};

	const viaIdToken = (which: "apple" | "google", get: () => Promise<IdTokenSignIn | null>) =>
		withBusy(which, async () => {
			const token = await get();
			if (token) await signInWithIdToken(server, token);
		});

	const viaBrowser = () =>
		withBusy("browser", async () => {
			setMoreOpen(false);
			const done = await signIn(server);
			if (!done) setError(null);
		});

	const openLegal = (url: string) =>
		void openBrowserAsync(url).catch(() => showToast({ title: t`Couldn't open the browser. Try again.` }));

	return (
		<View className="flex-1 bg-background" testID="welcome">
			<Screen edges={["top", "bottom"]}>
				<View className="w-full max-w-[480px] flex-1 gap-8 self-center pt-12">
					<View className="items-center gap-4">
						<Image source={require("../../../assets/icon.png")} accessible={false} style={appMark} />
						<View className="items-center gap-2">
							<Typography.Heading type="h2" accessibilityRole="header" className="text-center">
								{t`Welcome to Rezumi`}
							</Typography.Heading>
							<Typography type="body-sm" className="text-center text-muted">
								{t`Resumes, cover letters, applications and your portfolio, in one place.`}
							</Typography>
						</View>
					</View>

					<ErrorAlert message={error} title={t`Sign-in didn't complete`} />

					{options.isPending ? (
						<View className="gap-3">
							<Skeleton variant="none" className="h-12 rounded-xl" />
							<Skeleton variant="none" className="h-12 rounded-xl" />
						</View>
					) : (
						<View className="gap-3">
							{native?.apple ? (
								<AppleSignInButton
									isDisabled={busy !== null}
									onPress={() => void viaIdToken("apple", getAppleIdToken)}
									testID="sign-in-apple"
								/>
							) : null}
							{google ? (
								<Button
									variant="secondary"
									size="lg"
									isDisabled={busy !== null}
									onPress={() => void viaIdToken("google", () => getGoogleIdToken(google))}
									testID="sign-in-google"
								>
									<Icon name="google-logo" size={20} />
									<Button.Label>{busy === "google" ? t`Signing in…` : t`Continue with Google`}</Button.Label>
								</Button>
							) : null}
							{emailAuth ? (
								<Button
									variant={native?.apple || google ? "secondary" : "primary"}
									size="lg"
									isDisabled={busy !== null}
									onPress={() => router.push(routes.emailSignIn())}
									testID="sign-in-email"
								>
									<Icon name="envelope" size={20} />
									<Button.Label>{t`Continue with email`}</Button.Label>
								</Button>
							) : null}
							{emailAuth && signUps ? (
								<Button
									variant="ghost"
									size="lg"
									isDisabled={busy !== null}
									onPress={() => router.push(routes.createAccount())}
									testID="create-account-link"
								>
									<Button.Label>{t`New to Rezumi? Create an account`}</Button.Label>
								</Button>
							) : null}
							{browserProviders.length > 0 ? (
								<Button variant="ghost" isDisabled={busy !== null} onPress={() => setMoreOpen(true)}>
									<Button.Label>
										{busy === "browser" ? t`Finish in the browser…` : t`More ways to sign in`}
									</Button.Label>
								</Button>
							) : null}
							{flags.data?.allowGuestLogin ? (
								<Button
									variant="tertiary"
									isDisabled={busy !== null}
									onPress={() => void withBusy("guest", () => signInAsGuest(server))}
									testID="sign-in-guest"
								>
									<Button.Label>{busy === "guest" ? t`Signing in…` : t`Try without an account`}</Button.Label>
								</Button>
							) : null}
							{!signUps ? (
								<Text size="xs" tone="muted" className="text-center">
									{t`New account sign-ups are turned off on this server.`}
								</Text>
							) : null}
						</View>
					)}

					<View className="flex-1 justify-end gap-2">
						{__DEV__ ? (
							<ListSection>
								<ListRow
									title={server.replace(/^https?:\/\//, "")}
									description={t`Server (development builds only)`}
									icon="globe-simple"
									chevron
									onPress={() => router.push(routes.server())}
								/>
							</ListSection>
						) : null}
						<View className="flex-row flex-wrap items-center justify-center gap-x-4">
							<LinkButton size="sm" onPress={() => openLegal(LEGAL_URLS.terms)}>
								<LinkButton.Label>{t`Terms`}</LinkButton.Label>
							</LinkButton>
							<LinkButton size="sm" onPress={() => openLegal(LEGAL_URLS.privacy)}>
								<LinkButton.Label>{t`Privacy policy`}</LinkButton.Label>
							</LinkButton>
						</View>
					</View>
				</View>
			</Screen>

			<Sheet
				isOpen={moreOpen}
				onOpenChange={setMoreOpen}
				title={t`More ways to sign in`}
				closeLabel={t`Close`}
				detents={["auto"]}
			>
				<View className="gap-4 pb-4">
					<Typography type="body-sm" className="text-muted">
						{t`These open Rezumi's sign-in page in a secure browser sheet. You come back here when you're done.`}
					</Typography>
					<ListSection>
						{browserProviders.map(([id, icon, label]) => (
							<ListRow key={id} title={label} icon={icon} chevron onPress={() => void viaBrowser()} />
						))}
					</ListSection>
				</View>
			</Sheet>
		</View>
	);
}
