import type { AuthSession } from "@rezumi/auth/types";
import type { Selection } from "react-aria-components";
import { Dropdown, Label, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Pressable } from "react-aria-components/Pressable";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { useTheme } from "@/features/theme/provider";
import { clearAccountData } from "@/libs/auth/clear-account-data";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { changeLocale, localeMap } from "@/libs/locale";
import { isTheme } from "@/libs/theme";

type Props = {
	children: ({ session }: { session: AuthSession }) => React.ComponentProps<typeof Pressable>["children"];
};

export function UserDropdownMenu({ children }: Props) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { i18n } = useLingui();
	const { theme, setTheme } = useTheme();
	const { data: session } = authClient.useSession();

	const handleLocaleChange = (keys: Selection) => {
		const [key] = keys === "all" ? [] : [...keys];
		if (typeof key === "string") changeLocale(key);
	};

	const handleThemeChange = (keys: Selection) => {
		const [key] = keys === "all" ? [] : [...keys];
		if (typeof key === "string" && isTheme(key)) setTheme(key);
	};

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
						id="settings"
						textValue={t`Settings`}
						onAction={() => void router.navigate({ to: "/dashboard/settings" })}
					>
						<Icon name="gear-six" />
						<Label>
							<Trans>Settings</Trans>
						</Label>
					</Dropdown.Item>
					<Separator />
					<Dropdown.SubmenuTrigger>
						<Dropdown.Item id="language" textValue={t`Language`}>
							<Icon name="translate" size={16} />
							<Label>
								<Trans comment="Menu item that opens language selection submenu">Language</Trans>
							</Label>
							<Dropdown.SubmenuIndicator />
						</Dropdown.Item>
						<Dropdown.Popover className="max-h-[400px] overflow-y-auto">
							<Dropdown.Menu
								selectionMode="single"
								disallowEmptySelection
								selectedKeys={new Set([i18n.locale])}
								onSelectionChange={handleLocaleChange}
							>
								{Object.entries(localeMap).map(([value, label]) => (
									<Dropdown.Item key={value} id={value} textValue={i18n.t(label)}>
										<Label>{i18n.t(label)}</Label>
										<Dropdown.ItemIndicator type="dot" />
									</Dropdown.Item>
								))}
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown.SubmenuTrigger>

					<Dropdown.SubmenuTrigger>
						<Dropdown.Item id="theme" textValue={t`Theme`}>
							<Icon name="palette" size={16} />
							<Label>
								<Trans comment="Menu item that opens appearance theme selection submenu">Theme</Trans>
							</Label>
							<Dropdown.SubmenuIndicator />
						</Dropdown.Item>
						<Dropdown.Popover>
							<Dropdown.Menu
								selectionMode="single"
								disallowEmptySelection
								selectedKeys={new Set([theme])}
								onSelectionChange={handleThemeChange}
							>
								<Dropdown.Item id="light" textValue={t`Light`}>
									<Label>
										<Trans comment="Appearance theme option for light mode">Light</Trans>
									</Label>
									<Dropdown.ItemIndicator type="dot" />
								</Dropdown.Item>
								<Dropdown.Item id="dark" textValue={t`Dark`}>
									<Label>
										<Trans comment="Appearance theme option for dark mode">Dark</Trans>
									</Label>
									<Dropdown.ItemIndicator type="dot" />
								</Dropdown.Item>
								<Dropdown.Item id="system" textValue={t`System`}>
									<Label>
										<Trans comment="Appearance theme option that follows the operating system">System</Trans>
									</Label>
									<Dropdown.ItemIndicator type="dot" />
								</Dropdown.Item>
							</Dropdown.Menu>
						</Dropdown.Popover>
					</Dropdown.SubmenuTrigger>

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
