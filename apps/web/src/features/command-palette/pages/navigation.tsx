import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../store";
import { BaseCommandGroup, PaletteItem, searchText } from "./base";
import { useDialogStore } from "@/dialogs/store";
import { useCoachLauncher } from "@/features/coach-panel/launcher";
import { openCoachPanel } from "@/features/coach-panel/store";
import { orpc } from "@/libs/orpc/client";

export function NavigationCommandGroup() {
	const navigate = useNavigate();
	const { session } = useRouteContext({ strict: false });
	const reset = useCommandPaletteStore((state) => state.reset);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const launchCoach = useCoachLauncher();
	// Portfolio is listed only for accounts that have one switched on (the sidebar's rule).
	const { data: portfolio } = useQuery({ ...orpc.portfolio.status.queryOptions(), enabled: Boolean(session) });

	const onNavigate = async (path: string) => {
		await navigate({ to: path });
		reset();
	};

	return (
		<>
			<BaseCommandGroup heading={<Trans>Go to…</Trans>}>
				<PaletteItem
					id="navigation.home"
					textValue={searchText(t`Home`, [t`Home`])}
					onAction={() => onNavigate(session ? "/dashboard" : "/")}
				>
					<Icon name="house" size={16} />
					<Trans>Home</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.documents"
					textValue={searchText(t`Documents`, [t`Documents`, t`Resumes`, t`Cover letters`])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/documents")}
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
					// Documents' trash, in its section menu.
					textValue={searchText(t`Trash`, [t`Trash`, t`Deleted`, t`Documents`])}
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
					id="navigation.offers"
					textValue={searchText(t`Offers`, [t`Offers`, t`Compare offers`, t`Applications`])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/applications/offers")}
				>
					<Icon name="scales" size={16} />
					<Trans>Offers</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.coach"
					textValue={searchText(t`Coach`, [t`Coach`, t`Career`, t`Conversations`])}
					isDisabled={!session}
					onAction={() => {
						reset();
						// Coach full screen is already the coach.
						if (pathname.startsWith("/dashboard/coach")) return;
						// The panel lives in the dashboard's shell: elsewhere (the editor, public pages) go to Home first.
						if (!pathname.startsWith("/dashboard")) {
							void navigate({ to: "/dashboard" });
							openCoachPanel();
							return;
						}
						// A job's workspace opens that job's coach; other pages, the panel.
						launchCoach("open");
					}}
				>
					<Icon name="sparkle" size={16} />
					<Trans>Coach</Trans>
				</PaletteItem>

				{session && portfolio?.enabled && (
					<PaletteItem
						id="navigation.portfolio"
						textValue={searchText(t`Portfolio`, [t`Portfolio`, t`Website`])}
						onAction={() => onNavigate("/dashboard/portfolio")}
					>
						<Icon name="globe-hemisphere-west" size={16} />
						<Trans>Portfolio</Trans>
					</PaletteItem>
				)}

				<PaletteItem
					id="navigation.profile"
					textValue={searchText(t`Profile`, [
						t`Profile`,
						t({ message: "Details", context: "Profile page: your name, photo, contact details and links" }),
						t`Career`,
						t`Facts`,
						t`Stories`,
						t`Experience`,
						t`Education`,
						t`Skills`,
					])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/profile")}
				>
					<Icon name="user-circle" size={16} />
					<Trans>Profile</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.account"
					textValue={searchText(t`Account`, [
						t`Account`,
						t`Account details`,
						t`Password`,
						t`Two-step verification`,
						t`Passkeys`,
						t`Export data`,
						t`Delete account`,
					])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/settings/account")}
				>
					<Icon name="user-circle" size={16} />
					<Trans>Account</Trans>
				</PaletteItem>

				<PaletteItem
					id="navigation.settings"
					textValue={searchText(t`Settings`, [
						t`Settings`,
						t`Theme`,
						t`Language`,
						t`Timezone`,
						t`AI providers`,
						t`Web access`,
						t`API keys`,
						t`MCP`,
						t`Integrations`,
					])}
					isDisabled={!session}
					onAction={() => onNavigate("/dashboard/settings/app")}
				>
					<Icon name="gear-six" size={16} />
					<Trans>Settings</Trans>
				</PaletteItem>
			</BaseCommandGroup>
		</>
	);
}
