// The frame of Applications → All (List, Board, Calendar): the tab's top bar, the sections row, the layout segment
// with Save a job, then the layout. It owns two things every layout shares: the application detail sheet, opened
// with `?open=<id>` (`useOpenApplication`; links and reminders land here), and the Save a job sheet. On tablets the
// List shows the detail beside itself (`detailBeside`), so the frame leaves the sheet closed there.
import type { AllView } from "./views-row";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ApplicationDetailSheet } from "./detail/detail-sheet";
import { SaveJobSheet } from "./save-sheet";
import { AllViewsSegment, ApplicationsViewsRow } from "./views-row";
import { TabTopBar } from "@/shell/tab-chrome";
import { Button, Icon } from "@/ui";

/** Opens an application's detail sheet over the current layout (`?open=`), or closes it with null. */
export function useOpenApplication() {
	const router = useRouter();
	return (id: string | null) => router.setParams({ open: id ?? undefined });
}

/** The application whose detail is open (`?open=`), if any. */
export function useOpenApplicationId() {
	const { open } = useLocalSearchParams<{ open?: string }>();
	return typeof open === "string" && open ? open : null;
}

type ApplicationsFrameProps = {
	view: AllView;
	children: ReactNode;
	/** Tablet List: the layout shows the open application beside itself instead of in a sheet. */
	detailBeside?: boolean | undefined;
};

export function ApplicationsFrame({ view, children, detailBeside = false }: ApplicationsFrameProps) {
	const { t } = useLingui();
	const openId = useOpenApplicationId();
	const openApplication = useOpenApplication();
	const [saving, setSaving] = useState(false);
	return (
		<View className="flex-1 bg-background">
			<TabTopBar title={t`Applications`} />
			<ApplicationsViewsRow current={view} />
			<View className="flex-row items-center gap-3 px-4 pt-3 pb-1">
				<AllViewsSegment current={view} />
				<Button size="sm" variant="secondary" onPress={() => setSaving(true)} testID="save-job">
					<Icon name="plus" size={16} />
					<Button.Label>{t`Save a job`}</Button.Label>
				</Button>
			</View>
			<View className="flex-1">{children}</View>
			<ApplicationDetailSheet applicationId={detailBeside ? null : openId} onClose={() => openApplication(null)} />
			<SaveJobSheet
				isOpen={saving}
				onOpenChange={setSaving}
				onSaved={(id) => {
					setSaving(false);
					openApplication(id);
				}}
			/>
		</View>
	);
}
