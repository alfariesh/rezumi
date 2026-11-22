import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { orpc } from "@/api/client";
import { PageImage } from "@/preview/page-image";
import { usePreview } from "@/preview/usePreview";
import { EmptyState, Skeleton, Text } from "@/ui";

type VersionPageProps = { resumeId: string; versionId: string; offline: boolean };

/** A version's pages, rendered on the device, read-only. */
export function VersionPage({ resumeId, versionId, offline }: VersionPageProps) {
	const { t } = useLingui();
	const [width, setWidth] = useState(0);
	const version = useQuery({
		...orpc.resume.getVersion.queryOptions({ input: { resumeId, versionId } }),
		enabled: !offline,
	});
	const preview = usePreview(version.data?.data ?? null, undefined, {
		viewport: { width: Math.max(1, width), height: width * 4, offset: 0, zoom: 1 },
	});
	const failed = version.isError || preview.error;

	return (
		<View className="gap-3" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} testID="version-page">
			{failed ? (
				<EmptyState
					kind="inline"
					title={t`Couldn't load this version's page.`}
					action={{
						label: t`Retry`,
						onPress: () => {
							void version.refetch();
							preview.retry();
						},
					}}
				/>
			) : !preview.result || width === 0 ? (
				<Skeleton variant="none" className="aspect-[1/1.414] w-full rounded-lg" />
			) : (
				preview.result.pages.map((page) => (
					<View key={page.index} className="gap-1">
						<View className="overflow-hidden rounded-lg bg-paper shadow-surface">
							<PageImage
								uri={page.uri}
								accessibilityLabel={t`Page ${page.index + 1} · read-only`}
								style={[{ width, height: (width * page.height) / page.width }]}
							/>
						</View>
					</View>
				))
			)}
			{preview.result?.hasTextLoss ? <Text tone="warning">{t`Some text couldn't be rendered.`}</Text> : null}
		</View>
	);
}
