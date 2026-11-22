// The 10-minute briefing stored with the plan (focus, opening, stories, the honesty note), so it opens without AI,
// and the stories it asks the person to bring.
import type { SavedData, SavedItem } from "../queries";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Block, Notice } from "../blocks";
import { useStories } from "../queries";
import { routes } from "@/routes";
import { ListGroup, ListRow, Sheet, Text, Typography, cx } from "@/ui";

export type Briefing = SavedItem & { data: SavedData<"briefing"> };

export const isBriefing = (item: SavedItem | undefined): item is Briefing => item?.data.kind === "briefing";

export function BriefingNotes({ briefing }: { briefing: Briefing }) {
	const { t } = useLingui();
	const { data } = briefing;
	const items = [
		{ label: t`Your focus`, text: data.focus },
		{ label: t`Your opening`, text: data.opening && `“${data.opening}”`, italic: true },
		{ label: data.stories.length === 2 ? t`Two stories` : t`Stories`, text: data.stories.join("\n") },
		{ label: t`Keep it honest`, text: data.honesty },
	];
	return (
		<View className="gap-4">
			{items
				.filter((item) => item.text)
				.map((item) => (
					<View key={item.label} className="gap-1">
						<Text size="xs" weight="semibold" tone="muted">
							{item.label}
						</Text>
						<Typography type="body-sm" className={cx(item.italic && "italic")}>
							{item.text}
						</Typography>
					</View>
				))}
		</View>
	);
}

type BriefingSheetProps = { briefing: Briefing; isOpen: boolean; onOpenChange: (open: boolean) => void };

export function BriefingSheet({ briefing, isOpen, onOpenChange }: BriefingSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`10-minute briefing`}
			closeLabel={t`Close`}
			detents={[0.9]}
		>
			<BriefingNotes briefing={briefing} />
		</Sheet>
	);
}

type StoriesToBringProps = { applicationId: string; briefing: Briefing };

export function StoriesToBring({ applicationId, briefing }: StoriesToBringProps) {
	const { t } = useLingui();
	const router = useRouter();
	const stories = useStories(applicationId);
	const bring = briefing.data.storyIds.flatMap((id) => stories.data?.find((story) => story.id === id) ?? []);
	if (!stories.data || (bring.length === 0 && !briefing.data.missingStory)) return null;
	return (
		<Block title={t`Stories to bring`}>
			{bring.length > 0 ? (
				<ListGroup variant="secondary">
					{bring.map((story) => (
						<ListRow
							key={story.id}
							title={story.data.title}
							icon="book-open"
							onPress={() => router.push(routes.profile("stories"))}
						/>
					))}
				</ListGroup>
			) : null}
			{briefing.data.missingStory ? (
				<Notice status="warning" icon="question" message={briefing.data.missingStory} />
			) : null}
		</Block>
	);
}
