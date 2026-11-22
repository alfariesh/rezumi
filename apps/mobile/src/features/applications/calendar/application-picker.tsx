// Scheduling from the calendar starts by choosing whose interview it is: the open applications, newest first.
import type { ApplicationSummary } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { getStageLabel } from "@/features/applications/stages";
import { ListRow, ListSection, Sheet, StageDot, Text } from "@/ui";

type ApplicationPickerSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	applications: readonly ApplicationSummary[];
	/** The slot tapped on the grid, already worded ("Tue 20 Oct, 10:00"). */
	when: string | null;
	onPick: (id: string) => void;
	/** The picker has slid away: the interview sheet can open now (one native sheet at a time). */
	onDidDismiss: () => void;
};

export function ApplicationPickerSheet({ isOpen, onOpenChange, onDidDismiss, ...list }: ApplicationPickerSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			onDidDismiss={onDidDismiss}
			title={t`Schedule an interview`}
			closeLabel={t`Cancel`}
			testID="calendar-picker"
		>
			<ApplicationPickerList {...list} />
		</Sheet>
	);
}

type ApplicationPickerListProps = Pick<ApplicationPickerSheetProps, "applications" | "when" | "onPick">;

export function ApplicationPickerList({ applications, when, onPick }: ApplicationPickerListProps) {
	const { t } = useLingui();
	const sorted = applications.toSorted((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	return (
		<View className="gap-3 pb-2">
			<Text tone="muted">{when ? t`For ${when}. Which application is it for?` : t`Which application is it for?`}</Text>
			<ListSection>
				{sorted.map((application) => (
					<ListRow
						key={application.id}
						title={application.role}
						description={`${application.company} · ${getStageLabel(application.status)}`}
						leading={<StageDot stage={application.status} />}
						onPress={() => onPick(application.id)}
						testID={`calendar-pick-${application.id}`}
					/>
				))}
			</ListSection>
		</View>
	);
}
