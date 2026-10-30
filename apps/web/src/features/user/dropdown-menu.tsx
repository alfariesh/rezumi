import type { AuthSession } from "@rezumi/auth/types";
import { Dropdown, Label, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Pressable } from "react-aria-components/Pressable";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { clearAccountData } from "@/libs/auth/clear-account-data";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";

type Props = {
	children: ({ session }: { session: AuthSession }) => React.ComponentProps<typeof Pressable>["children"];
};

/** The account menu: Account and Settings are pages; theme and language live in Settings and the command bar. */
export function UserDropdownMenu({ children }: Props) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();

	const handleLogout = async () => {
		const toastId = toast.add({ type: "loading", description: t`Signing out...` });

		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					toast.close(toastId);
					clearAccountData(queryClient);
					void router.invalidate();
				},
				onError: ({ error }) => {
					toast.add({
						type: "error",
						description: getReadableErrorMessage(
							error,
							t({
								comment: "Fallback toast when signing out fails",
								message: "Couldn't sign out. Try again.",
							}),
						),
						id: toastId,
					});
				},
			},
		});
	};

	if (!session?.user) return null;

	return (
		<Dropdown>
			<Pressable>{children({ session: session as AuthSession })}</Pressable>

			<Dropdown.Popover placement="top start" className="min-w-52">
				<Dropdown.Menu>
					<Dropdown.Item
						id="account"
						textValue={t`Account`}
						onAction={() => void router.navigate({ to: "/dashboard/settings/account" })}
					>
						<Icon name="user-circle" size={16} />
						<Label>
							<Trans>Account</Trans>
						</Label>
					</Dropdown.Item>
					<Dropdown.Item
						id="settings"
						textValue={t`Settings`}
						onAction={() => void router.navigate({ to: "/dashboard/settings/app" })}
					>
						<Icon name="gear-six" size={16} />
						<Label>
							<Trans>Settings</Trans>
						</Label>
					</Dropdown.Item>

					<Separator />

					<Dropdown.Item id="sign-out" textValue={t`Sign out`} onAction={handleLogout}>
						<Icon name="sign-out" size={16} />
						<Label>
							<Trans comment="User menu action to sign out of current account">Sign out</Trans>
						</Label>
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
