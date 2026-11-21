// STARR, as the web's Stories page has it (apps/web/src/features/career/knowledge/stories.tsx): the five parts in
// order, which ones a story needs, and when a backing fact changed after the story was saved.
import type { Fact, Story } from "@/features/career/hooks";
import type { CareerStoryData } from "@rezumi/schema/career";
import { t } from "@lingui/core/macro";

export type PartKey = "situation" | "task" | "action" | "result" | "reflection";

/** Situation, Task and Action are required; Result and Reflection stay blank until supported. */
export const storyParts = () =>
	[
		{ key: "situation", letter: "S", label: t`Situation`, placeholder: t`What was happening before you started?` },
		{ key: "task", letter: "T", label: t`Task`, placeholder: t`What were you responsible for?` },
		{ key: "action", letter: "A", label: t`Action`, placeholder: t`What did you do, specifically?` },
		{
			key: "result",
			letter: "R",
			label: t`Result`,
			placeholder: t`What changed? Leave blank if you can’t support it.`,
		},
		{ key: "reflection", letter: "R", label: t`Reflection`, placeholder: t`What would you do differently?` },
	] satisfies { key: PartKey; letter: string; label: string; placeholder: string }[];

export const REQUIRED_PARTS: readonly PartKey[] = ["situation", "task", "action"];

export const partLimit = (key: PartKey) => (key === "action" ? 6000 : 4000);

/** How many of the five parts hold text. */
export const filledParts = (data: Pick<CareerStoryData, PartKey>) =>
	storyParts().filter((part) => data[part.key].trim()).length;

/** A backing fact was corrected after the story was last saved. */
export const factChanged = (story: Story, facts: ReadonlyMap<string, Fact>) =>
	story.data.factIds.some((id) => {
		const at = facts.get(id)?.revisions.at(-1)?.at;
		return at !== undefined && new Date(at) > new Date(story.updatedAt);
	});

export const emptyStory = (): CareerStoryData => ({
	applicationId: null,
	title: "",
	situation: "",
	task: "",
	action: "",
	result: "",
	reflection: "",
	factIds: [],
	tags: [],
});
