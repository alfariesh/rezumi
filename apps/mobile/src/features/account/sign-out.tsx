import { useLingui } from "@lingui/react/macro";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { client } from "@/api/client";
import { getAccountScope, SignOutCleanupError, signOut, useSession } from "@/auth/session";
import { routes } from "@/routes";
import { ConfirmDialog, ListRow, showToast } from "@/ui";

type SignOutMode = "local" | "all" | "server";

export function useSignOut(mode: SignOutMode = "local") {
	const router = useRouter();
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const pendingSettings = useIsMutating({ mutationKey: ["settings"] });
	const running = useRef(false);
	const [busy, setBusy] = useState(false);
	const leave = async () => {
		if (running.current || pendingSettings > 0) return;
		const scope = getAccountScope();
		if (!scope) return;
		running.current = true;
		setBusy(true);
		try {
			if (mode === "all") await client.auth.signOutAllDevices(undefined, { context: { scope } });
			if (getAccountScope() !== scope) return;
			await queryClient.cancelQueries();
			if (getAccountScope() !== scope) return;
			let partial = false;
			try {
				await signOut();
			} catch (error) {
				if (!(error instanceof SignOutCleanupError)) throw error;
				partial = true;
			}
			queryClient.clear();
			router.replace(mode === "server" ? routes.server() : routes.signIn());
			if (partial) showToast({ title: t`Signed out, but some data on this device couldn't be removed.` });
		} catch {
			showToast({
				title: mode === "all" ? t`Couldn't sign out of all devices. Try again.` : t`Couldn't sign out. Try again.`,
				variant: "danger",
			});
		} finally {
			running.current = false;
			setBusy(false);
		}
	};
	return { leave, disabled: busy || pendingSettings > 0 };
}

type SignOutRowProps = { mode?: SignOutMode };
export function SignOutRow({ mode = "local" }: SignOutRowProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const [open, setOpen] = useState(false);
	const { leave, disabled } = useSignOut(mode);
	const all = mode === "all";
	const switchServer = mode === "server";
	const label = all ? t`Sign out of all devices` : t`Sign out`;

	return (
		<>
			<ListRow
				title={switchServer ? t`Server` : label}
				description={switchServer ? server : undefined}
				icon={switchServer ? "globe" : "sign-out"}
				tone={switchServer ? "default" : "danger"}
				isDisabled={disabled}
				onPress={() => setOpen(true)}
			/>
			<ConfirmDialog
				isOpen={open}
				onOpenChange={setOpen}
				title={switchServer ? t`Switch server?` : all ? t`Sign out of all devices?` : t`Sign out?`}
				message={
					all
						? t`This ends your Rezumi sessions on every device. Edits that haven't synced from this device will be lost.`
						: t`You will be signed out of ${server}. Any edits not yet synced from this device will be lost.`
				}
				confirmLabel={label}
				cancelLabel={t`Stay signed in`}
				destructive
				onConfirm={() => void leave()}
			/>
		</>
	);
}
