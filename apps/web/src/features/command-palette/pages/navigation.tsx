import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../store";
import { BaseCommandGroup, PaletteItem, searchText } from "./base";
import { useDialogStore } from "@/dialogs/store";

export function NavigationCommandGroup() {
	const navigate = useNavigate();
	const { session } = useRouteContext({ strict: false });
	const reset = useCommandPaletteStore((state) => state.reset);
	const pushPage = useCommandPaletteStore((state) => state.pushPage);

	const onNavigate = async (path: string) => {
		await navigate({ to: path });
		reset();
	};

	return (
		<>
			<BaseCommandGroup heading={<Trans>Go to…</Trans>}>
				<PaletteItem id="navigation.home" textValue={searchText(t`Home`, [t`Home`])} onAction={() => onNavigate("/")}>
					<Icon name="house" size={16} />
					<Trans>Home</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.documents"
					textValue={searchText(t`Documents`, [t`Documents`, t`Resumes`, t`Cover letters`])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard")}
				>
					<Icon name="file-text" size={16} />
					<Trans>Documents</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.documents.new"
					textValue={searchText(t`New document`, [t`New document`, t`Create`, t`Import`])}
					isDisabled={!session}
					onAction={() => {
						reset();
						useDialogStore.getState().openDialog("document.new", undefined);
					}}
				>
					<Icon name="plus" size={16} />
					<Trans>New document</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.trash"
					textValue={searchText(t`Trash`, [t`Trash`, t`Deleted`])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/trash")}
				>
					<Icon name="trash" size={16} />
					<Trans>Trash</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.ats-checker"
					textValue={searchText(t`ATS checker`, [t`ATS checker`, t`Check a PDF`])}
					onAction={() => onNavigate("/ats-checker")}
				>
					<Icon name="seal-check" size={16} />
					<Trans>ATS checker</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.applications"
					textValue={searchText(t`Applications`, [t`Applications`, t`Jobs`])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/applications")}
				>
					<Icon name="briefcase" size={16} />
					<Trans>Applications</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.applications.new"
					textValue={searchText(t`New application`, [t`New application`, t`Add application`, t`Job`])}
					isDisabled={!session}
					onAction={async () => {
						await navigate({ to: "/dashboard/applications", search: { create: true } });
						reset();
					}}
				>
					<Icon name="plus" size={16} />
					<Trans>New application</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.settings"
					textValue={searchText(t`Settings`, [t`Settings`])}
					isDisabled={!session}
					onAction={() => pushPage("settings")}
				>
					<Icon name="gear-six" size={16} />
					<Trans>Settings</Trans>
				</PaletteItem>
			</BaseCommandGroup>

			<BaseCommandGroup page="settings" heading={<Trans>Settings</Trans>}>
				<PaletteItem
					id="navigation.settings.account"
					textValue={searchText(t`Account`, [
						t`Account`,
						t`Profile`,
						t`Password`,
						t`Two-step verification`,
						t`Passkeys`,
						t`Export data`,
						t`Delete account`,
					])}
					onAction={() => onNavigate("/dashboard/settings/account")}
				>
					<Icon name="user-circle" size={16} />
					<Trans>Account</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.settings.preferences"
					textValue={searchText(t`Preferences`, [t`Preferences`, t`Theme`, t`Language`])}
					onAction={() => onNavigate("/dashboard/settings/preferences")}
				>
					<Icon name="gear-six" size={16} />
					<Trans>Preferences</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.settings.ai"
					textValue={searchText(t`AI & developer`, [
						t`AI & developer`,
						t`AI providers`,
						t`API keys`,
						t`MCP`,
						t`Integrations`,
					])}
					onAction={() => onNavigate("/dashboard/settings/ai")}
				>
					<Icon name="key" size={16} />
					<Trans>AI & developer</Trans>
				</PaletteItem>
			</BaseCommandGroup>
		</>
	);
}
