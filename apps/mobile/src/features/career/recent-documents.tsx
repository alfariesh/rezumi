import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useDocuments } from "@/features/documents/queries";
import { Thumbnail } from "@/features/documents/thumbnail";
import { routes } from "@/routes";
import { Button, Icon, Text, useTheme } from "@/ui";

/** How many documents Home previews, before the tile that starts a new one. */
const LIMIT = 3;
/** A card's width: two and a bit fit a phone, so the next one peeks and the row reads as swipeable. */
const CARD_WIDTH = 144;

type RecentDocumentsProps = {
	/** One column: the row runs to the screen's edges so the next card peeks. In two columns it stays in its own. */
	bleed: boolean;
};

/**
 * The first page of the documents edited last, newest first, each opening its editor, and a tile to start a new one.
 * The full library stays in the Documents tab. Nothing shows until a document exists: the Documents tab leads then.
 */
export function RecentDocuments({ bleed }: RecentDocumentsProps) {
	const { t, i18n } = useLingui();
	const { colors, space, radius, size } = useTheme();
	const router = useRouter();
	const documents = useDocuments();
	const recent = (documents.data ?? [])
		.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
		.slice(0, LIMIT);
	if (recent.length === 0) return null;

	return (
		<View style={{ gap: space.s3 }}>
			<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
				<Text variant="title" accessibilityRole="header">
					{t`Recent documents`}
				</Text>
				<Button variant="link" size="sm" label={t`All documents`} onPress={() => router.navigate(routes.documents())} />
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				// The screen's padding comes back as the row's own, so the cards start where the other sections do.
				style={bleed ? { marginHorizontal: -space.s4 } : undefined}
				contentContainerStyle={{ paddingHorizontal: bleed ? space.s4 : 0, gap: space.s3 }}
			>
				{recent.map((document) => (
					<Pressable
						key={`${document.type}:${document.id}`}
						accessibilityRole="button"
						accessibilityLabel={document.name}
						onPress={() =>
							router.push(document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id))
						}
						style={{ width: CARD_WIDTH, gap: space.s2 }}
					>
						<Thumbnail document={document} visible />
						<View style={{ gap: space.s1 }}>
							<Text variant="label" numberOfLines={1}>
								{document.name}
							</Text>
							<Text variant="caption" color="ink3" numberOfLines={1}>
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
					style={{ width: CARD_WIDTH, gap: space.s2 }}
				>
					<View
						style={{
							width: "100%",
							aspectRatio: 210 / 297,
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: colors.sunken,
							borderRadius: radius.rSm,
						}}
					>
						<Icon name="plus" color={colors.ink3} size={size.icon.bar} />
					</View>
					<Text variant="label" numberOfLines={1}>
						{t`New document`}
					</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}
