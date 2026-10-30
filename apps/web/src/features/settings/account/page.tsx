import { Trans } from "@lingui/react/macro";
import { useRouteContext, useSearch } from "@tanstack/react-router";
import { DataSection } from "./data";
import { ProfileSection } from "./profile";
import { SecuritySection } from "./security";
import { PageHeader } from "@/components/layout/page-header";

export function AccountSettings() {
	const { session } = useRouteContext({ from: "/dashboard" });
	const { deleteAccount } = useSearch({ from: "/dashboard/settings/account" });

	return (
		<>
			<PageHeader title={<Trans>Account</Trans>} />
			<ProfileSection session={session} />
			<SecuritySection />
			<DataSection openDeletion={deleteAccount ?? false} />
		</>
	);
}
