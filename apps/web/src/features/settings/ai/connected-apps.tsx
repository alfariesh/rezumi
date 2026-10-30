import { Alert, Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { SettingsRow, SettingsRows, SettingsSection } from "../section";
import { authClient } from "@/libs/auth/client";

const queryKey = ["auth", "connected-apps"];

export function ConnectedAppsSection() {
	const queryClient = useQueryClient();
	const {
		data: connections = [],
		isPending,
		error,
	} = useQuery({
		queryKey,
		queryFn: async () => {
			const { data, error } = await authClient.oauth2.getConsents();
			if (error) throw new Error(t`Couldn't load connected applications. Refresh the page to try again.`);
			return Promise.all(
				(data ?? []).map(async (connection) => {
					const client = await authClient.oauth2
						.publicClient({ query: { client_id: connection.clientId } })
						.catch(() => null);
					return { ...connection, clientName: client?.data?.client_name?.trim() || connection.clientId };
				}),
			);
		},
	});
	const revoke = useMutation({
		mutationFn: async (id: string) => {
			const { error } = await authClient.oauth2.deleteConsent({ id });
			if (error) throw new Error(t`Couldn't revoke this connection. Try again.`);
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey }),
	});

	return (
		<SettingsSection
			id="connected-apps"
			title={<Trans>Connected applications</Trans>}
			description={<Trans>Revoke an application's access to your account.</Trans>}
		>
			{error || revoke.error ? (
				<Alert status="danger">
					<Alert.Indicator>
						<Icon name="warning-circle" />
					</Alert.Indicator>
					<Alert.Content>
						<Alert.Description>{(error ?? revoke.error)?.message}</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}
			{isPending ? (
				<p role="status" className="flex items-center gap-2 text-sm text-muted">
					<Spinner size="sm" color="current" aria-hidden />
					<Trans>Loading connections...</Trans>
				</p>
			) : connections.length === 0 ? (
				<p className="text-sm text-muted">
					<Trans>No connected applications yet. Apps you allow to access your account appear here.</Trans>
				</p>
			) : (
				<SettingsRows>
					{connections.map((connection) => (
						<SettingsRow
							as="li"
							key={connection.id}
							icon="link-simple-horizontal"
							title={connection.clientName}
							description={connection.scopes.join(", ")}
						>
							<Button
								variant="secondary"
								size="sm"
								isDisabled={revoke.isPending}
								onPress={() => revoke.mutate(connection.id)}
							>
								<Trans>Revoke access</Trans>
							</Button>
						</SettingsRow>
					))}
				</SettingsRows>
			)}
		</SettingsSection>
	);
}
