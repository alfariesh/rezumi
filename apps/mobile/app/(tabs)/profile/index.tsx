import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { routes } from "@/routes";
import { PreparingTab } from "@/shell/preparing-tab";

// Until Phase 06 builds Profile. The old Knowledge screen stays reachable meanwhile. Must not ship (Phase 16 checks).
export default function ProfileTab() {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<PreparingTab
			title={t`Profile`}
			icon="user-circle"
			heading={t`Your Profile is coming to the app`}
			description={t`Everything your resumes, letters and Coach start from. For now, your facts and stories are in Knowledge.`}
			action={{ label: t`Open Knowledge`, onPress: () => router.push(routes.knowledge()) }}
			webPath="/dashboard/profile"
		/>
	);
}
