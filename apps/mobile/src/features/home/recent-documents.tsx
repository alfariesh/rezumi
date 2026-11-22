// The three documents edited last, newest first, each opening its editor, and a tile that starts a new one. The
// full library stays in the Documents tab. Thumbnails in their final shape while loading, a retry when the read fails,
// and nothing once it is known that no document exists: First run leads then.
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { LoadError } from "./section";
import { useDocuments } from "@/features/documents/queries";
import { Thumbnail } from "@/features/documents/thumbnail";
import { routes } from "@/routes";
import { Button, Card, Icon, Skeleton, Text, Typography } from "@/ui";

const LIMIT = 3;

export function RecentDocuments() {
	const { t, i18n } = useLingui();
	const router = useRouter();
	const documents = useDocuments();
	const recent = (documents.data ?? [])
		.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, LIMIT);
	if (documents.data && recent.length === 0) return null;

	return (
		<View className="gap-2" testID="home-recent-documents">
			<View className="min-h-11 flex-row items-center gap-2">
				<Icon name="file-text" size={20} tone="muted" />
				<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
					{t`Recent documents`}
				</Typography.Heading>
				<Button size="sm" variant="ghost" onPress={() => router.navigate(routes.documents())}>
					<Button.Label>{t`All documents`}</Button.Label>
				</Button>
			</View>
			{documents.isError ? (
				<Card>
					<LoadError onRetry={() => void documents.refetch()} />
				</Card>
			) : !documents.data ? (
				<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="flex-row gap-3">
					{Array.from({ length: LIMIT }, (_, index) => (
						<View key={index} className="w-36 gap-2">
							<Skeleton variant="none" className="aspect-[210/297] w-full rounded-lg" />
							<Skeleton variant="none" className="h-3.5 w-2/3 rounded-md" />
							<Skeleton variant="none" className="h-3 w-full rounded-md" />
						</View>
					))}
				</View>
			) : (
				// The row runs to the screen's edges so the next card peeks and reads as swipeable.
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					className="-mx-4"
					contentContainerClassName="gap-3 px-4"
				>
					{recent.map((document) => (
						<Pressable
							key={`${document.type}:${document.id}`}
							accessibilityRole="button"
							accessibilityLabel={document.name}
							onPress={() =>
								router.push(document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id))
							}
							testID={`recent-${document.id}`}
							className="w-36 gap-2"
						>
							<Thumbnail document={document} visible />
							<View className="gap-0.5">
								<Text weight="medium" numberOfLines={1}>
									{document.name}
								</Text>
								<Text size="xs" tone="muted" numberOfLines={1}>
									{document.type === "letter" ? t`Letter` : t`Resume`}
									{" · "}
									{document.updatedAt.toLocaleDateString(i18n.locale)}
								</Text>
							</View>
						</Pressable>
					))}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t`New document`}
						onPress={() => router.push(routes.new())}
						className="w-36 gap-2"
					>
						<View className="aspect-[210/297] w-full items-center justify-center rounded-lg bg-surface-secondary">
							<Icon name="plus" size={24} tone="muted" />
						</View>
						<Text weight="medium" numberOfLines={1}>
							{t`New document`}
						</Text>
					</Pressable>
				</ScrollView>
			)}
		</View>
	);
}
