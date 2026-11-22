import { useLingui } from "@lingui/react/macro";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { SignOutCleanupError, signOut, useSession } from "@/auth/session";
import { routes } from "@/routes";
import { ConfirmDialog, ListRow, showToast } from "@/ui-legacy";

/**
 * Signs out of the current server (or out of it to pick another, `switchServer`): cancels queries, clears this
 * account's data on the device and returns to sign-in. Settings' row and the avatar menu share it.
 */
export function useSignOut(switchServer = false) {
	const router = useRouter();
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const pendingSettings = useIsMutating({ mutationKey: ["settings"] });
	const [busy, setBusy] = useState(false);
	const leave = async () => {
		setBusy(true);
		try {
			await queryClient.cancelQueries();
			let partial = false;
			try {
				await signOut();
			} catch (error) {
				// Signed out all the same: only some of this account's data on the device could not be removed.
				if (!(error instanceof SignOutCleanupError)) throw error;
				partial = true;
			}
			queryClient.clear();
			router.replace(switchServer ? routes.server() : routes.signIn());
			if (partial) showToast({ message: t`Signed out, but some data on this device couldn't be removed.` });
		} catch {
			showToast({ message: t`Couldn't sign out. Try again.` });
		} finally {
			setBusy(false);
		}
	};
	return { leave, disabled: busy || pendingSettings > 0 };
}

type SignOutRowProps = { switchServer?: boolean };
export function SignOutRow({ switchServer = false }: SignOutRowProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const [open, setOpen] = useState(false);
	const { leave, disabled } = useSignOut(switchServer);
	return (
		<>
			<ListRow
				title={switchServer ? t`Server` : t`Sign out`}
				subtitle={switchServer ? server : undefined}
				leading={switchServer ? "globe" : "sign-out"}
				destructive={!switchServer}
				chevron={switchServer}
				disabled={disabled}
				onPress={() => setOpen(true)}
			/>
			<ConfirmDialog
				open={open}
				title={switchServer ? t`Switch server?` : t`Sign out?`}
				message={t`You will be signed out of ${server}. Any edits not yet synced from this device will be lost.`}
				confirmLabel={t`Sign out`}
				destructive
				onCancel={() => setOpen(false)}
				onConfirm={() => {
					setOpen(false);
					void leave();
				}}
			/>
		</>
	);
}
