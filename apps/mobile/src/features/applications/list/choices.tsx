// Pick lists shared by the row menu, the bulk bar and the detail: a stage to move to, and why an application closed.
import type { ApplicationClosedReason, ApplicationStatus } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { CLOSED_REASONS, PIPELINE } from "@rezumi/career/applications";
import { getClosedReasonLabel, getStageLabel } from "../stages";
import { ListRow, ListSection, StageDot, Text } from "@/ui";

type StageChoicesProps = {
	/** The stage the application is in now (checked); null for several applications. */
	current: ApplicationStatus | null;
	onPick: (status: ApplicationStatus) => void;
};

/** "Move to…": every stage of the pipeline, the current one checked. Closing has its own list, with a reason. */
export function StageChoices({ current, onPick }: StageChoicesProps) {
	return (
		<ListSection>
			{PIPELINE.map((status) => (
				<ListRow
					key={status}
					title={getStageLabel(status)}
					leading={<StageDot stage={status} />}
					isSelected={status === current}
					onPress={() => onPick(status)}
					testID={`move-to-${status}`}
				/>
			))}
		</ListSection>
	);
}

type ReasonChoicesProps = { onPick: (reason: ApplicationClosedReason) => void };

/** Why it closed, kept for Insights: one tap closes with that reason. */
export function ReasonChoices({ onPick }: ReasonChoicesProps) {
	const { t } = useLingui();
	return (
		<View className="gap-2">
			<ListSection>
				{CLOSED_REASONS.map((reason) => (
					<ListRow
						key={reason}
						title={getClosedReasonLabel(reason)}
						onPress={() => onPick(reason)}
						testID={`close-reason-${reason}`}
					/>
				))}
			</ListSection>
			<Text size="xs" tone="muted" className="px-1">
				{t`The reason is kept for Insights. Linked documents aren't touched.`}
			</Text>
		</View>
	);
}
