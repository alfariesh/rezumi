// Download & history, over the resume builder. The builder layout owns the draft; this screen only subscribes.
import { useLingui } from "@lingui/react/macro";
import { useNetworkState } from "expo-network";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useShareDocument } from "./document";
import { DownloadTab } from "./download";
import { Notice } from "./export-options";
import { useSession } from "@/auth/session";
import { DocumentMenu } from "@/features/document-menu";
import { HistoryPanel } from "@/features/history/history";
import { Button, Screen, Segment, Skeleton } from "@/ui";

type ExportScreenProps = { id: string; history?: boolean };

export function ExportScreen({ id, history = false }: ExportScreenProps) {
	const router = useRouter();
	const { t } = useLingui();
	const draft = useShareDocument(id);
	const session = useSession();
	const network = useNetworkState();
	const offline = network.isConnected === false || network.isInternetReachable === false;
	const [tab, setTab] = useState<"download" | "history">(history ? "history" : "download");

	const notices = (
		<>
			{offline && tab === "history" ? (
				<Notice
					status="accent"
					message={t`You're offline. History needs a connection. Download PDF works on this device.`}
				/>
			) : null}
			{draft.document?.isLocked ? (
				<Notice
					status="warning"
					message={t`This document is locked. You can still download and name versions. Unlock to edit or restore.`}
				/>
			) : null}
			{session.status !== "signed-in" ? <Notice status="warning" message={t`Sign in to continue.`} /> : null}
			{draft.status === "error" ? (
				<View className="gap-2">
					<Notice status="danger" message={t`Changes couldn't be saved. Retry before continuing.`} />
					<Button
						size="sm"
						variant="secondary"
						className="self-start"
						onPress={() => (draft.document ? draft.retry() : void draft.open(id).catch(() => {}))}
					>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : null}
		</>
	);

	const segment = (
		<Segment
			accessibilityLabel={t`Download & history`}
			value={tab}
			onValueChange={setTab}
			options={[
				{ value: "download", label: t`Download` },
				{ value: "history", label: t`History` },
			]}
		/>
	);

	return (
		<>
			<Stack.Screen options={{ title: t`Download & history`, headerRight: () => <DocumentMenu id={id} /> }} />
			{draft.document && tab === "history" ? (
				// History scrolls itself, so it sits under the segment instead of inside a scroll view.
				<Screen scroll={false} edges={["bottom"]}>
					{segment}
					{notices}
					<View className="flex-1">
						<HistoryPanel resume={draft.document} offline={offline} />
					</View>
				</Screen>
			) : (
				<Screen edges={["bottom"]}>
					{segment}
					{notices}
					{draft.document ? (
						<DownloadTab key={id} resume={draft.document} offline={offline} />
					) : (
						<View className="gap-3">
							<Skeleton variant="none" className="h-40 rounded-2xl" />
							<Skeleton variant="none" className="h-14 rounded-xl" />
						</View>
					)}
					<Button variant="ghost" onPress={() => router.back()}>
						<Button.Label>{t`Close`}</Button.Label>
					</Button>
				</Screen>
			)}
		</>
	);
}
