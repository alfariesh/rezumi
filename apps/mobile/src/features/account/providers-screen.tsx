import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsPage } from "./layout";
import { orpc } from "@/api/client";
import { ProviderList } from "@/features/ai/provider-list";
import { Text } from "@/ui";

export default function ProvidersScreen() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	return (
		<SettingsPage
			title={t`AI providers`}
			onRefresh={() => queryClient.invalidateQueries({ queryKey: orpc.aiProviders.key() })}
		>
			<Text tone="muted">{t`Writing help, tailored suggestions and the assistant. The default provider is used wherever you don't pick one. Your keys stay encrypted.`}</Text>
			<ProviderList />
		</SettingsPage>
	);
}
