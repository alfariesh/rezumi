// The workspace's top bar (a full-screen editor, no drawer): Back to where the person came from (else Applications),
// the company over the role and stage, then Application details and Ask coach.
import type { Application } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { useUserTime } from "@/features/applications/date";
import { describeNextStep, getNextStep } from "@/features/applications/next-step";
import { getStageLabel } from "@/features/applications/stages";
import { IconButton, Icon, StageLabel, Text, TopBar, cx } from "@/ui";

type WorkspaceBarProps = {
	title: string;
	application: Application | undefined;
	onBack: () => void;
	onDetails: () => void;
	onCoach: () => void;
};

export function WorkspaceBar({ title, application, onBack, onDetails, onCoach }: WorkspaceBarProps) {
	const { t } = useLingui();
	return (
		<View className="bg-background">
			<TopBar
				title={title}
				back={{ label: t`Back`, onPress: onBack }}
				actions={
					application ? (
						<>
							<IconButton
								icon="file-text"
								label={t`Application details`}
								onPress={onDetails}
								testID="workspace-details"
							/>
							<IconButton icon="sparkle" label={t`Ask coach`} onPress={onCoach} testID="workspace-coach" />
						</>
					) : null
				}
			/>
			{application ? (
				<View className="-mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-2">
					<Text tone="muted" numberOfLines={1} className="shrink">
						{application.role}
					</Text>
					<StageLabel stage={application.status} label={getStageLabel(application.status)} size="xs" tone="muted" />
				</View>
			) : null}
		</View>
	);
}

type NextStepLineProps = { application: Application; now: Date };

/** What the application needs next, on one line (the context column shows more on tablets). */
export function NextStepLine({ application, now }: NextStepLineProps) {
	const { t } = useLingui();
	const { locale, timeZone } = useUserTime();
	const text = describeNextStep(getNextStep(application, now), application, locale, timeZone);
	const label = [text.title, text.sub].filter(Boolean).join(" · ");
	return (
		<View
			accessible
			accessibilityLabel={t`Next step: ${label}`}
			className="flex-row items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2.5"
			testID="workspace-next-step"
		>
			<Icon name={text.icon} size={16} tone={text.tone === "warn" ? "warning" : "muted"} />
			<Text
				weight="medium"
				numberOfLines={2}
				className={cx(
					"flex-1",
					text.tone === "warn" && "text-warning-soft-foreground",
					text.tone === "muted" && "text-muted",
				)}
			>
				{label}
			</Text>
		</View>
	);
}
