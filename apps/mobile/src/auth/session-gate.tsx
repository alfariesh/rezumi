import type { Href } from "expo-router";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { setAfterSignIn, takeAfterSignIn } from "./after-sign-in";
import { getSession, signOut, subscribeIdentity, subscribeSession, useSession } from "./session";
import { routes } from "@/routes";
import { Alert, Button, Sheet, showToast } from "@/ui";

/**
 * Route guard and session-expired prompt. Mounted once in app/_layout.tsx.
 * - Signed out anywhere but `(auth)`: go to sign-in.
 * - Signing out: go to sign-in at once, in the same tick, so a caller that navigates after `signOut()` always has the
 *   last word; then a toast.
 * - Signed in on an `(auth)` screen: go to Home (or the screen `setAfterSignIn` named).
 * - Expired: stay where the user is, under a sheet that asks to sign in again.
 * - Account change (sign-in, switch, sign-out, expiry): the React Query cache is cancelled and cleared.
 */
export function SessionGate() {
	const { t } = useLingui();
	// Bind to this root; Android recreation can unbind the previous root's global router during cleanup.
	const router = useRouter();
	const { status } = useSession();
	const segments = useSegments();
	const navigationReady = !!useRootNavigationState()?.key;
	const path = segments.join("/");
	const inAuth = path.startsWith("(auth)");
	// The OAuth redirect route steps back by itself (app/(auth)/auth/native-callback.tsx).
	const atCallback = path === "(auth)/auth/native-callback";
	// The reset link works whatever the session: a signed-in person may reset the password of the account they forgot.
	const atReset = path === "(auth)/auth/reset-password";
	const where = useRef({ inAuth });
	const queryClient = useQueryClient();

	// Server data belongs to one account: drop it (and stop its requests) the moment the account changes.
	useEffect(
		() =>
			subscribeIdentity(() => {
				void queryClient.cancelQueries();
				queryClient.clear();
			}),
		[queryClient],
	);
	const previous = useRef(status);

	useEffect(() => {
		where.current = { inAuth };
	});

	useEffect(() => {
		let last = getSession().status;
		return subscribeSession(() => {
			const { status: next } = getSession();
			const leaving = next === "signed-out" && (last === "signed-in" || last === "expired");
			last = next;
			if (!leaving) return;
			setAfterSignIn(null);
			if (!where.current.inAuth) router.replace(routes.signIn());
			showToast({ title: t`Signed out. Your documents are still there.` });
		});
	}, [router, t]);

	useEffect(() => {
		const before = previous.current;
		previous.current = status;
		if (!navigationReady || atCallback) return;
		const signedOutNow = before === "signed-in" || before === "expired";
		if (status === "signed-out" && !inAuth && !signedOutNow) router.replace(routes.signIn());
		else if (status === "signed-in" && inAuth && !atReset) {
			const next = takeAfterSignIn();
			// Back to the screen the expired session was on (it is still in the stack), or Home.
			if (next) router.dismissTo(next);
			else router.replace(routes.home());
		}
	}, [navigationReady, status, inAuth, atCallback, atReset, router]);

	return status === "expired" && !inAuth ? <SessionExpiredSheet /> : null;
}

function SessionExpiredSheet() {
	const { t } = useLingui();
	const router = useRouter();
	const pathname = usePathname();
	// The sheet cannot be dismissed: swiping it away presents it again.
	const [presentation, setPresentation] = useState(0);

	const signInAgain = () => {
		setAfterSignIn(pathname as Href);
		router.push(routes.signIn());
	};

	return (
		<Sheet
			key={presentation}
			isOpen
			onOpenChange={() => setPresentation((count) => count + 1)}
			title={t`Sign in again`}
		>
			<View className="gap-3 pb-4">
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>{t`Your session ended`}</Alert.Title>
						<Alert.Description>
							{t`Sign in again to keep working. Edits you made are kept on this device and sync after you sign in.`}
						</Alert.Description>
					</Alert.Content>
				</Alert>
				<Button size="lg" onPress={signInAgain} testID="session-expired-sign-in">
					<Button.Label>{t`Sign in again`}</Button.Label>
				</Button>
				<Button
					variant="ghost"
					size="lg"
					onPress={() =>
						void signOut().catch(() =>
							showToast({ title: t`Signed out, but some data on this device couldn't be removed.` }),
						)
					}
				>
					<Button.Label>{t`Sign out`}</Button.Label>
				</Button>
			</View>
		</Sheet>
	);
}
