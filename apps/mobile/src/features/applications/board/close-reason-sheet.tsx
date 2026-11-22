// Closing an application from the Board asks why (as the web's board does): one tap on a reason closes it.
import type { ApplicationSummary } from "@/features/applications/types";
import type { ApplicationClosedReason } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { CLOSED_REASONS } from "@rezumi/career/applications";
import { getClosedReasonLabel } from "@/features/applications/stages";
import { ListRow, ListSection, Sheet, Text } from "@/ui";

type CloseReasonSheetProps = {
	application: ApplicationSummary | null;
	onPick: (reason: ApplicationClosedReason) => void;
	onCancel: () => void;
};

export function CloseReasonSheet({ application, onPick, onCancel }: CloseReasonSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet
			isOpen={application !== null}
			onOpenChange={(open) => !open && onCancel()}
			title={t`Close application`}
			closeLabel={t`Cancel`}
			testID="board-close-reason"
		>
			{application ? <CloseReasonList application={application} onPick={onPick} /> : null}
		</Sheet>
	);
}

type CloseReasonListProps = { application: ApplicationSummary; onPick: (reason: ApplicationClosedReason) => void };

export function CloseReasonList({ application, onPick }: CloseReasonListProps) {
	const { t } = useLingui();
	return (
		<View className="gap-3 pb-2">
			<Text tone="muted">{t`Why did ${application.role} at ${application.company} close?`}</Text>
			<ListSection>
				{CLOSED_REASONS.map((reason) => (
					<ListRow key={reason} title={getClosedReasonLabel(reason)} onPress={() => onPick(reason)} chevron={false} />
				))}
			</ListSection>
		</View>
	);
}
