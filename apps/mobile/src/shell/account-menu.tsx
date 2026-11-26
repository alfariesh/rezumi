import type { IconName } from "@/ui";
// The account's links and Sign out, shared by the tablet sidebar's account menu and the phone drawer (01-desain 2):
// Account, Plan, App settings, Help & legal, then Sign out after a confirmation.
import type { Href } from "expo-router";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { getInitials } from "@rezumi/utils/string";
import { useSession } from "@/auth/session";
import { useProfile } from "@/features/account/queries";
import { useSignOut } from "@/features/account/sign-out";
import { routes } from "@/routes";
import { Avatar, ConfirmDialog, Menu, Text } from "@/ui";

export type AccountLink = { id: string; label: string; icon: IconName; href: Href };

/** The account pages, in the web's order. */
export function useAccountLinks(): AccountLink[] {
	const { t } = useLingui();
	return [
		{ id: "account", label: t`Account`, icon: "user-circle", href: routes.account("account") },
		{ id: "plan", label: t`Plan`, icon: "seal-check", href: routes.account("membership") },
		{ id: "settings", label: t`App settings`, icon: "gear-six", href: routes.account("preferences") },
		{ id: "help", label: t`Help & legal`, icon: "question", href: routes.account() },
	];
}

/** Sign out, asked first: edits not yet synced from this device are lost. Render `dialog` once. */
export function useSignOutConfirm() {
	const { t } = useLingui();
	const { server } = useSession();
	const signOut = useSignOut();
	const [confirming, setConfirming] = useState(false);
	const dialog = (
		<ConfirmDialog
			isOpen={confirming}
			onOpenChange={setConfirming}
			title={t`Sign out?`}
			message={t`You will be signed out of ${server}. Any edits not yet synced from this device will be lost.`}
			confirmLabel={t`Sign out`}
			cancelLabel={t`Stay signed in`}
			destructive
			onConfirm={() => void signOut.leave()}
		/>
	);
	return { ask: () => setConfirming(true), disabled: signOut.disabled, dialog };
}

type AccountAvatarProps = { size?: "sm" | "md" | "lg" | undefined };

/** The signed-in person's picture, or their initials while it loads or when there is none. */
export function AccountAvatar({ size = "sm" }: AccountAvatarProps) {
	const { t } = useLingui();
	const profile = useProfile();
	const name = profile.data?.name ?? "";
	const image = profile.data?.image;
	return (
		<Avatar size={size} alt={name || t`Account`}>
			{image ? <Avatar.Image source={{ uri: image }} /> : null}
			<Avatar.Fallback>{getInitials(name) || "?"}</Avatar.Fallback>
		</Avatar>
	);
}

type AccountButtonProps = {
	/** The sidebar shows the name beside the picture. */
	showName?: boolean | undefined;
};

/** The account at the tablet sidebar's foot: a menu of the account pages and Sign out. */
export function AccountButton({ showName = false }: AccountButtonProps) {
	const { t } = useLingui();
	const router = useRouter();
	const profile = useProfile();
	const links = useAccountLinks();
	const signOut = useSignOutConfirm();
	const name = profile.data?.name ?? "";

	return (
		<>
			<Menu>
				<Menu.Trigger asChild>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t`Account menu`}
						hitSlop={4}
						testID="account-menu"
						className="min-h-11 min-w-11 flex-row items-center justify-center gap-3"
					>
						<AccountAvatar />
						{showName ? (
							<Text weight="medium" numberOfLines={1} className="flex-1">
								{name || t`Account`}
							</Text>
						) : null}
					</Pressable>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={240}>
						{links.map((link) => (
							<Menu.Item key={link.id} onPress={() => router.push(link.href)}>
								<Menu.ItemTitle>{link.label}</Menu.ItemTitle>
							</Menu.Item>
						))}
						<Menu.Item variant="danger" isDisabled={signOut.disabled} onPress={signOut.ask}>
							<Menu.ItemTitle>{t`Sign out`}</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
			{signOut.dialog}
		</>
	);
}
