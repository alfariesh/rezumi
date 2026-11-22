// One application's detail: stage, next step, posting closed marker, notes, contacts, interviews, files, actions. In a
// native sheet on phones (and over Board and Calendar on tablets), or as a pane beside the list on tablets. Both show
// the copy the list already holds at once, then the full one.
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useApplication } from "../queries";
import { DetailBody } from "./detail-body";
import { useOnline } from "@/api/online";
import { Button, EmptyState, IconButton, Sheet, Skeleton } from "@/ui";

export type ApplicationDetailSheetProps = {
	/** The application to show; null closes the sheet. */
	applicationId: string | null;
	onClose: () => void;
};

/** The detail in a native sheet (phones, and Board/Calendar on tablets). */
export function ApplicationDetailSheet({ applicationId, onClose }: ApplicationDetailSheetProps) {
	const { t } = useLingui();
	// The sheet keeps the last application while it slides away.
	const [shown, setShown] = useState(applicationId);
	if (applicationId && applicationId !== shown) setShown(applicationId);
	const query = useApplication(shown ?? "");
	return (
		<Sheet
			isOpen={applicationId !== null}
			onOpenChange={(open) => !open && onClose()}
			title={query.data?.role ?? t`Application`}
			closeLabel={t`Close`}
			detents={[0.6, 1]}
			testID="application-detail-sheet"
		>
			{shown ? <DetailLoader key={shown} applicationId={shown} showTitle={false} onClose={onClose} /> : null}
		</Sheet>
	);
}

export type ApplicationDetailPaneProps = { applicationId: string; onClose: () => void };

/** The same detail as a pane beside the list (tablets, ≥ 700 pt). */
export function ApplicationDetailPane({ applicationId, onClose }: ApplicationDetailPaneProps) {
	const { t } = useLingui();
	return (
		<View className="flex-1 overflow-hidden rounded-2xl bg-surface">
			<View className="flex-row justify-end px-2 pt-2">
				<IconButton icon="x" label={t`Close the application`} onPress={onClose} testID="detail-pane-close" />
			</View>
			<ScrollView
				contentContainerClassName="px-5 pb-5"
				keyboardShouldPersistTaps="handled"
				accessibilityLabel={t`Application details`}
			>
				<DetailLoader key={applicationId} applicationId={applicationId} showTitle onClose={onClose} />
			</ScrollView>
		</View>
	);
}

type DetailLoaderProps = { applicationId: string; showTitle: boolean; onClose: () => void };

export function DetailLoader({ applicationId, showTitle, onClose }: DetailLoaderProps) {
	const { t } = useLingui();
	const query = useApplication(applicationId);
	const online = useOnline();
	if (query.data)
		return (
			<DetailBody
				application={query.data}
				showTitle={showTitle}
				stale={query.isRefetchError || !online}
				onClose={onClose}
			/>
		);
	if (query.isError)
		return (
			<View className="gap-3">
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't open this application`}
					description={t`Check your connection and try again. Your saved data hasn't changed.`}
					action={{ label: t`Try again`, onPress: () => void query.refetch() }}
				/>
				<Button variant="ghost" onPress={onClose}>
					<Button.Label>{t`Back to applications`}</Button.Label>
				</Button>
			</View>
		);
	return (
		<View
			className="gap-4 pb-6"
			accessibilityLabel={t`Loading`}
			accessibilityRole="progressbar"
			testID="detail-loading"
		>
			<Skeleton variant="none" className="h-4 w-1/2 rounded-md" />
			<Skeleton variant="none" className="h-11 w-full rounded-xl" />
			<Skeleton variant="none" className="h-24 w-full rounded-2xl" />
			<Skeleton variant="none" className="h-16 w-full rounded-2xl" />
		</View>
	);
}
