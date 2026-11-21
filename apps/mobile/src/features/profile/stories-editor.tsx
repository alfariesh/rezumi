// Writing a story: title, tags, the five parts and the facts behind it. The draft lives in the story pane (so the save
// button can sit in a sheet's footer); this file holds the fields and the rule for what a story needs before saving.
import type { PartKey } from "./stories-parts";
import type { Fact } from "@/features/career/hooks";
import type { CareerStoryData } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { REQUIRED_PARTS, partLimit, storyParts } from "./stories-parts";
import { PartTile } from "./stories-reader";
import {
	Checkbox,
	ChipInput,
	ControlField,
	Description,
	FieldError,
	Icon,
	Input,
	Label,
	Text,
	TextArea,
	TextField,
} from "@/ui";

/** What still stops the draft from saving, in words, or null when it can be saved. */
export function storyProblem(draft: CareerStoryData) {
	if (REQUIRED_PARTS.some((key) => !draft[key].trim())) return "parts" as const;
	if (!draft.title.trim()) return "title" as const;
	return null;
}

/** Facts a story may link: those shared with every application, or with the story's own one. */
export const linkableFacts = (facts: readonly Fact[], draft: CareerStoryData) =>
	facts.filter((fact) => !fact.applicationId || fact.applicationId === draft.applicationId);

/** The draft as the server takes it: trimmed, only facts the coach uses, tags without repeats. */
export function storyPayload(draft: CareerStoryData, facts: readonly Fact[]): CareerStoryData {
	const usable = new Set(
		linkableFacts(facts, draft)
			.filter((fact) => fact.status === "active")
			.map((fact) => fact.id),
	);
	return {
		applicationId: draft.applicationId,
		title: draft.title.trim(),
		situation: draft.situation.trim(),
		task: draft.task.trim(),
		action: draft.action.trim(),
		result: draft.result.trim(),
		reflection: draft.reflection.trim(),
		factIds: draft.factIds.filter((id) => usable.has(id)),
		tags: [...new Set(draft.tags.map((tag) => tag.trim()))].filter(Boolean).slice(0, 20),
	};
}

type StoryEditorFieldsProps = {
	draft: CareerStoryData;
	onChange: (patch: Partial<CareerStoryData>) => void;
	facts: readonly Fact[];
	/** After a save attempt: missing parts and title show as errors. */
	tried: boolean;
};

export function StoryEditorFields({ draft, onChange, facts, tried }: StoryEditorFieldsProps) {
	const { t } = useLingui();
	const linkable = linkableFacts(facts, draft);
	const problem = tried ? storyProblem(draft) : null;
	return (
		<View className="gap-5">
			<TextField isRequired isInvalid={tried && !draft.title.trim()}>
				<Label>{t`Title`}</Label>
				<Input
					variant="secondary"
					value={draft.title}
					maxLength={200}
					placeholder={t`Name the story`}
					accessibilityLabel={t`Title`}
					onChangeText={(title) => onChange({ title })}
				/>
				<FieldError>{t`Give the story a title before you can save.`}</FieldError>
			</TextField>
			<ChipInput
				variant="secondary"
				label={t`Tags`}
				values={draft.tags}
				max={20}
				maxLength={100}
				placeholder={t`Add a tag, then Return`}
				removeLabel={(tag) => t`Remove ${tag}`}
				onChange={(tags) => onChange({ tags })}
			/>

			{storyParts().map((part) => {
				const text = draft[part.key];
				const missing = tried && REQUIRED_PARTS.includes(part.key) && !text.trim();
				return (
					<View key={part.key} className="flex-row gap-3.5">
						<PartTile letter={part.letter} filled={!!text.trim()} />
						<TextField className="flex-1" isRequired={REQUIRED_PARTS.includes(part.key)} isInvalid={missing}>
							<Label>{part.label}</Label>
							<TextArea
								variant="secondary"
								value={text}
								maxLength={partLimit(part.key)}
								placeholder={part.placeholder}
								accessibilityLabel={part.label}
								onChangeText={(value) => onChange({ [part.key]: value } as Pick<CareerStoryData, PartKey>)}
							/>
							<FieldError>{t`Add what happened before you can save.`}</FieldError>
						</TextField>
					</View>
				);
			})}

			<View className="gap-2">
				<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
					{t`Backed by`}
				</Text>
				{linkable.map((fact) => {
					const disabled = fact.status !== "active";
					const checked = draft.factIds.includes(fact.id) && !disabled;
					return (
						<ControlField
							key={fact.id}
							isSelected={checked}
							isDisabled={disabled}
							onSelectedChange={(value) =>
								onChange({
									factIds: value ? [...draft.factIds, fact.id] : draft.factIds.filter((id) => id !== fact.id),
								})
							}
							className="items-start gap-2.5 rounded-xl bg-surface-secondary px-3 py-2.5"
						>
							<ControlField.Indicator>
								<Checkbox accessibilityLabel={fact.text} />
							</ControlField.Indicator>
							<View className="flex-1">
								<Label>{fact.text}</Label>
								{disabled ? <Description>{t`Not used in coaching, so it can't back a story.`}</Description> : null}
							</View>
						</ControlField>
					);
				})}
				{linkable.length === 0 ? <Text tone="muted">{t`No facts to link yet. Add them in Facts.`}</Text> : null}
			</View>

			{problem ? (
				<View accessibilityRole="alert" className="flex-row items-center gap-1.5">
					<Icon name="warning-circle" size={16} tone="danger" />
					<Text tone="danger" className="flex-1">
						{problem === "parts"
							? t`Add what happened before you can save.`
							: t`Give the story a title before you can save.`}
					</Text>
				</View>
			) : null}
		</View>
	);
}
