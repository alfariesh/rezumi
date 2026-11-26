import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { ApiKeys } from "./api-keys";
import { useBrowserLink } from "./browser";
import { ExportDataRow } from "./export";
import { SettingsPage } from "./layout";
import { ProfileEditor } from "./profile";
import { useProfile } from "./queries";
import { SignOutRow } from "./sign-out";
import { orpc } from "@/api/client";
import { getServer } from "@/auth/session";
import { EmptyState, Icon, ListRow, ListSection, Skeleton } from "@/ui";

export default function AccountScreen() {
	const { t } = useLingui();
	const profile = useProfile();
	const queryClient = useQueryClient();
	const openLink = useBrowserLink();
	const refresh = () =>
		Promise.allSettled([profile.refetch(), queryClient.invalidateQueries({ queryKey: orpc.auth.apiKeys.list.key() })]);
	const accountUrl = () => `${getServer()}/dashboard/settings/account`;
	const browse = () => void openLink(accountUrl()).then(refresh);
	const external = <Icon name="arrow-up-right" tone="muted" size={16} />;

	return (
		<SettingsPage title={t`Account`} onRefresh={refresh}>
			{profile.isPending ? <Skeleton variant="none" className="h-32 rounded-xl" /> : null}
			{profile.isError ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load your profile.`}
					action={{ label: t`Try again`, onPress: () => void refresh() }}
				/>
			) : null}
			{profile.data ? (
				<ListSection title={t`Profile`}>
					<ProfileEditor key={profile.data.id} profile={profile.data} />
				</ListSection>
			) : null}
			<ListSection
				title={t`Sign-in & security`}
				footer={t`Security settings open in the browser. You may need to sign in there.`}
			>
				<ListRow
					title={t`Email`}
					description={profile.data?.email}
					icon="envelope-simple"
					trailing={external}
					onPress={browse}
				/>
				<ListRow title={t`Password`} icon="password" trailing={external} onPress={browse} />
				<ListRow title={t`Two-step verification`} icon="shield-check" trailing={external} onPress={browse} />
				<ListRow title={t`Passkeys`} icon="fingerprint" trailing={external} onPress={browse} />
				<ListRow title={t`Linked accounts`} icon="plugs-connected" trailing={external} onPress={browse} />
			</ListSection>
			{profile.data ? <ApiKeys userId={profile.data.id} /> : null}
			<ListSection title={t`Your data`}>
				<ExportDataRow />
				<ListRow
					title={t`Delete account`}
					description={t`Opens the browser to confirm permanent deletion.`}
					icon="trash"
					tone="danger"
					trailing={external}
					onPress={() => void openLink(`${accountUrl()}?deleteAccount=true`)}
				/>
			</ListSection>
			<ListSection>
				{__DEV__ ? <SignOutRow mode="server" /> : null}
				<SignOutRow />
				<SignOutRow mode="all" />
			</ListSection>
		</SettingsPage>
	);
}
