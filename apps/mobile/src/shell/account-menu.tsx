// The avatar at the end of every tab's top bar (and the sidebar's foot): the account menu, as on the web. Account,
// Plan (Android only, without prices: K6), App settings, Help & legal, then Sign out after a confirmation.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { getInitials } from "@rezumi/utils/string";
import { useSession } from "@/auth/session";
import { canShowPlans, usePlan } from "@/features/billing/plan";
import { useProfile } from "@/features/settings/queries";
import { useSignOut } from "@/features/settings/sign-out";
import { routes } from "@/routes";
import { Avatar, ConfirmDialog, Menu, Text } from "@/ui";

type AccountButtonProps = {
	/** The sidebar shows the name beside the picture. */
	showName?: boolean | undefined;
};

export function AccountButton({ showName = false }: AccountButtonProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { server } = useSession();
	const profile = useProfile();
	const plan = usePlan();
	const signOut = useSignOut();
	const [confirming, setConfirming] = useState(false);
	const name = profile.data?.name ?? "";
	const image = profile.data?.image;

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
						<Avatar size="sm" alt={name || t`Account`}>
							{image ? <Avatar.Image source={{ uri: image }} /> : null}
							<Avatar.Fallback>{getInitials(name) || "?"}</Avatar.Fallback>
						</Avatar>
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
						<Menu.Item onPress={() => router.push(routes.account("account"))}>
							<Menu.ItemTitle>{t`Account`}</Menu.ItemTitle>
						</Menu.Item>
						{canShowPlans() && plan?.enabled ? (
							<Menu.Item onPress={() => router.push(routes.account("membership"))}>
								<Menu.ItemTitle>{t`Plan`}</Menu.ItemTitle>
							</Menu.Item>
						) : null}
						<Menu.Item onPress={() => router.push(routes.account("preferences"))}>
							<Menu.ItemTitle>{t`App settings`}</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item onPress={() => router.push(routes.account())}>
							<Menu.ItemTitle>{t`Help & legal`}</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item variant="danger" isDisabled={signOut.disabled} onPress={() => setConfirming(true)}>
							<Menu.ItemTitle>{t`Sign out`}</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
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
		</>
	);
}
