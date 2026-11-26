import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { SettingsPage } from "@/features/account/layout";
import { AiReportForm } from "@/features/ai/report-content";

export default function AiReportScreen() {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<SettingsPage title={t`Report AI content`}>
			<AiReportForm source="other" onSent={() => router.back()} />
		</SettingsPage>
	);
}
