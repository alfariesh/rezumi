import { useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useBrowserLink } from "./browser";
import { client, orpc } from "@/api/client";
import { useSession } from "@/auth/session";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { ConfirmDialog, EmptyState, ListRow, ListSection, Skeleton, showToast } from "@/ui";

type ApiKeysProps = { userId: string };
export function ApiKeys({ userId }: ApiKeysProps) {
	const { t, i18n } = useLingui();
	const { server } = useSession();
	const open = useBrowserLink();
	const queryClient = useQueryClient();
	const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
	const apiLocked = !hasPlanFeature(usePlan(), "automationApi");
	const keys = useQuery(
		orpc.auth.apiKeys.list.queryOptions({ queryKey: [...orpc.auth.apiKeys.list.key(), server, userId], retry: false }),
	);
	const revoke = useMutation({
		mutationKey: ["settings", "revoke-key"],
		mutationFn: async (keyId: string) => {
			const result = await client.auth.apiKeys.delete({ keyId });
			if (!result.success) throw new Error("Key revocation rejected");
		},
		onSuccess: () => {
			showToast({ title: t`API key revoked. Apps using it stop working now.`, variant: "success" });
			void queryClient.invalidateQueries({ queryKey: orpc.auth.apiKeys.list.key() });
		},
		onError: () => showToast({ title: t`Couldn't revoke the key. Try again.`, variant: "danger" }),
	});
	const date = (value: Date | null) => (value ? i18n.date(value, { dateStyle: "medium" }) : t`Never`);
	return (
		<>
			<ListSection
				title={t`API keys`}
				footer={t`Keys act as you and can access your documents. New keys are created in your browser account settings.`}
			>
				{apiLocked ? (
					<ListRow title={t`API and MCP access isn't available`} icon="lock" />
				) : (
					<ListRow
						title={t`New API key`}
						icon="arrow-up-right"
						onPress={() => void open(`${server}/dashboard/settings/app#api-keys`).then(() => keys.refetch())}
					/>
				)}
				{keys.isPending ? <Skeleton variant="none" className="m-3 h-12 rounded-xl" /> : null}
				{keys.isError ? (
					<EmptyState
						kind="inline"
						title={t`Couldn't load API keys.`}
						action={{ label: t`Try again`, onPress: () => void keys.refetch() }}
					/>
				) : null}
				{keys.data?.apiKeys.length === 0 ? <ListRow title={t`No keys yet.`} /> : null}
				{keys.data?.apiKeys.map((key) => (
					<ListRow
						key={key.id}
						title={key.name ?? t`Unnamed key`}
						description={t`Created ${date(key.createdAt)} · Last used ${date(key.lastRequest)} · Expires ${date(key.expiresAt)}`}
						icon="key"
						value={t`Revoke`}
						accessibilityHint={t`Revoke this API key`}
						chevron={false}
						isDisabled={revoke.isPending}
						onPress={() => setSelected({ id: key.id, name: key.name ?? t`Unnamed key` })}
					/>
				))}
			</ListSection>
			<ConfirmDialog
				isOpen={selected !== null}
				onOpenChange={(open) => {
					if (!open) setSelected(null);
				}}
				title={t`Revoke API key?`}
				message={t`Apps using “${selected?.name ?? ""}” will stop working. This can't be undone.`}
				confirmLabel={t`Revoke key`}
				cancelLabel={t`Keep key`}
				destructive
				onConfirm={() => {
					if (selected) revoke.mutate(selected.id);
				}}
			/>
		</>
	);
}
