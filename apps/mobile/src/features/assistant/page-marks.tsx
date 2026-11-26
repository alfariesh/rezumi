import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { routes } from "@/routes";
import { Button, Icon, Text } from "@/ui";

export { useMarkedResumeData } from "./proposals";

type ProposedEditsCaptionProps = { resumeId: string; pending: number };

/**
 * Page tab: "2 proposed edits on this page · nothing changes until you accept", with Review back to the Assistant.
 * Render it over the page when `useMarkedResumeData(...).pending > 0`.
 */
export function ProposedEditsCaption({ resumeId, pending }: ProposedEditsCaptionProps) {
	const router = useRouter();
	const { t } = useLingui();
	if (pending === 0) return null;
	return (
		<View
			accessibilityLiveRegion="polite"
			className="flex-row items-center gap-2 rounded-xl bg-accent-soft py-1 ps-3 pe-1"
		>
			<Icon name="sparkle" size={16} tone="accent" />
			<Text tone="accent" className="flex-1">
				{plural(pending, {
					one: "# proposed edit on this page · nothing changes until you accept",
					other: "# proposed edits on this page · nothing changes until you accept",
				})}
			</Text>
			<Button variant="tertiary" size="sm" onPress={() => router.push(routes.assistant(resumeId))}>
				<Button.Label>{t`Review`}</Button.Label>
			</Button>
		</View>
	);
}
