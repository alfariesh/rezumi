// One story, read: its title and tags, the five parts with their letters, and the facts behind it.
import type { PartKey } from "./stories-parts";
import type { Fact, Story } from "@/features/career/hooks";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { factChanged, storyParts } from "./stories-parts";
import { Chip, Icon, Text, Typography, cx } from "@/ui";

type PartTileProps = { letter: string; filled: boolean; small?: boolean };

/** A part's letter in a tile: tinted when the part holds text, quiet when it is still blank. */
export function PartTile({ letter, filled, small = false }: PartTileProps) {
	return (
		<View
			className={cx(
				"items-center justify-center",
				small ? "size-7 rounded-lg" : "size-9 rounded-xl",
				filled ? "bg-accent-soft" : "bg-default",
			)}
		>
			<Text
				size={small ? "sm" : "base"}
				weight="semibold"
				className={filled ? "text-accent-soft-foreground" : "text-muted"}
			>
				{letter}
			</Text>
		</View>
	);
}

type PartTilesProps = { data: Record<PartKey, string> };

/** The five letters in a row, as the list shows each story's progress. */
export function PartTiles({ data }: PartTilesProps) {
	return (
		<View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
			{storyParts().map((part) => (
				<PartTile key={part.key} letter={part.letter} filled={!!data[part.key].trim()} small />
			))}
		</View>
	);
}

export function ChangedNotice() {
	const { t } = useLingui();
	return (
		<Chip size="sm" variant="soft" color="warning" className="self-start">
			<Icon name="warning" size={14} tone="warning" />
			<Chip.Label>{t`A fact changed. Review this story.`}</Chip.Label>
		</Chip>
	);
}

type StoryReaderProps = { story: Story; facts: ReadonlyMap<string, Fact> };

export function StoryReader({ story, facts }: StoryReaderProps) {
	const { t } = useLingui();
	const backing = story.data.factIds.flatMap((id) => facts.get(id) ?? []);
	return (
		<View className="gap-5">
			<View className="gap-2">
				<Typography.Heading type="h4" accessibilityRole="header">
					{story.data.title}
				</Typography.Heading>
				{story.data.tags.length > 0 ? (
					<View className="flex-row flex-wrap gap-1">
						{story.data.tags.map((tag) => (
							<Chip key={tag} size="sm" variant="soft" color="default">
								<Chip.Label>{tag}</Chip.Label>
							</Chip>
						))}
					</View>
				) : (
					<Text size="xs" tone="muted">
						{t`No tags yet`}
					</Text>
				)}
				{factChanged(story, facts) ? <ChangedNotice /> : null}
			</View>

			<View className="gap-4">
				{storyParts().map((part) => {
					const text = story.data[part.key].trim();
					return (
						<View key={part.key} className="flex-row gap-3.5">
							<PartTile letter={part.letter} filled={!!text} />
							<View className="min-w-0 flex-1 gap-1">
								<Text weight="semibold" tone="muted" accessibilityRole="header">
									{part.label}
								</Text>
								{text ? (
									<Typography type="body" selectable>
										{text}
									</Typography>
								) : (
									<Typography type="body-sm" color="muted">
										{t`Not recorded yet. Leave it blank until you can support it.`}
									</Typography>
								)}
							</View>
						</View>
					);
				})}
			</View>

			<View className="gap-2">
				<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
					{t`Backed by`}
				</Text>
				{backing.map((fact) => (
					<View key={fact.id} className="flex-row items-start gap-2.5 rounded-xl bg-surface-secondary px-3 py-2.5">
						<Icon name="link-simple-horizontal" size={16} tone="accent" />
						<Text className="flex-1" tone={fact.status === "active" ? "default" : "muted"}>
							{fact.text}
						</Text>
					</View>
				))}
				{backing.length === 0 ? (
					<View className="flex-row items-center gap-1.5">
						<Icon name="warning" size={16} tone="warning" />
						<Text tone="warning" className="flex-1">
							{t`No supporting facts. Link one before using this story.`}
						</Text>
					</View>
				) : null}
			</View>
		</View>
	);
}
