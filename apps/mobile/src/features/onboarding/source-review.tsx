import type { Entry } from "@/features/entries/model";
// What the sources found, by part, everything ticked: untick what shouldn't go in the Profile. Nothing is saved until
// the person goes on. The web's SourceReview on a phone: a group's own row ticks all its entries.
import type { PhotoCandidate, ReviewEntry, ReviewGroup } from "@rezumi/resume/profile-sources";
import type { ProfileBasicsField, ProfileData } from "@rezumi/schema/profile/data";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { stripHtml } from "@rezumi/utils/string";
import { photoSourceLabel } from "./messages";
import { initialsOf, photoUrl } from "./photo-url";
import { useSession } from "@/auth/session";
import { SECTION_ICONS, SECTION_TITLES } from "@/features/entries/fields";
import { describeEntry } from "@/features/entries/model";
import { Avatar, Checkbox, ControlField, Icon, Label, Text, cx, haptics } from "@/ui";

type SourceReviewProps = {
	merged: ProfileData;
	groups: ReviewGroup[];
	excluded: ReadonlySet<string>;
	onExcludedChange: (excluded: Set<string>) => void;
	photos: PhotoCandidate[];
	photo: string | null;
	onPhotoChange: (url: string | null) => void;
	/** The person's name, for the photo previews' initials. */
	name: string;
};

export function SourceReview(props: SourceReviewProps) {
	const { merged, groups, excluded, onExcludedChange, photos, photo, onPhotoChange, name } = props;
	const setEntries = (keys: string[], included: boolean) => {
		const next = new Set(excluded);
		for (const key of keys) {
			if (included) next.delete(key);
			else next.add(key);
		}
		onExcludedChange(next);
	};
	return (
		<View className="gap-3" testID="source-review">
			{photos.length > 0 ? (
				<PhotoChoice photos={photos} photo={photo} onPhotoChange={onPhotoChange} name={name} />
			) : null}
			{groups.map((group) => (
				<ReviewGroupBlock key={group.id} group={group} merged={merged} excluded={excluded} onToggle={setEntries} />
			))}
		</View>
	);
}

type PhotoChoiceProps = Pick<SourceReviewProps, "photos" | "photo" | "onPhotoChange" | "name">;

function PhotoChoice({ photos, photo, onPhotoChange, name }: PhotoChoiceProps) {
	const { t } = useLingui();
	const { server } = useSession();
	const choices = [
		...photos.map((candidate) => ({ url: candidate.url, label: photoSourceLabel(candidate.source) })),
		null,
	];
	return (
		<View className="gap-3 rounded-xl bg-surface-secondary p-4">
			<View className="flex-row items-center gap-2">
				<Icon name="image" size={18} tone="muted" />
				<Text weight="semibold">{t`Photo`}</Text>
			</View>
			<View className="flex-row flex-wrap gap-4" accessibilityRole="radiogroup">
				{choices.map((choice) => {
					const selected = (choice?.url ?? null) === photo;
					const label = choice?.label ?? t`No photo`;
					return (
						<Pressable
							key={choice?.url ?? "none"}
							accessibilityRole="radio"
							accessibilityLabel={label}
							accessibilityState={{ selected }}
							onPress={() => {
								haptics.selection();
								onPhotoChange(choice?.url ?? null);
							}}
							className="items-center gap-1.5"
						>
							<View className={cx("rounded-full border-2 p-0.5", selected ? "border-accent" : "border-transparent")}>
								{choice ? (
									<Avatar alt={label} size="lg">
										<Avatar.Image source={{ uri: photoUrl(server, choice.url) }} />
										<Avatar.Fallback>{initialsOf(name)}</Avatar.Fallback>
									</Avatar>
								) : (
									<View className="size-12 items-center justify-center rounded-full bg-default">
										<Icon name="prohibit" tone="muted" />
									</View>
								)}
							</View>
							<Text size="xs" tone={selected ? "accent" : "muted"}>
								{label}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

type ReviewGroupBlockProps = {
	group: ReviewGroup;
	merged: ProfileData;
	excluded: ReadonlySet<string>;
	onToggle: (keys: string[], included: boolean) => void;
};

function ReviewGroupBlock({ group, merged, excluded, onToggle }: ReviewGroupBlockProps) {
	const { t, i18n } = useLingui();
	const keys = group.entries.map((entry) => entry.key);
	const kept = keys.filter((key) => !excluded.has(key)).length;
	const title =
		group.id === "details"
			? t`Your details`
			: group.id === "summary"
				? i18n._(SECTION_TITLES.summary)
				: i18n._(SECTION_TITLES[group.id]);
	const icon =
		group.id === "details" ? "user-circle" : group.id === "summary" ? SECTION_ICONS.summary : SECTION_ICONS[group.id];

	return (
		<View className="gap-1 rounded-xl border border-border p-2">
			<ControlField
				isSelected={kept === keys.length}
				onSelectedChange={(selected) => onToggle(keys, selected)}
				className="min-h-11 px-2"
			>
				<ControlField.Indicator>
					<Checkbox />
				</ControlField.Indicator>
				<Icon name={icon} size={18} tone="muted" />
				<Label className="flex-1">{title}</Label>
				<Text size="xs" tone="muted" tabular>
					{t`${kept} of ${keys.length}`}
				</Text>
			</ControlField>
			<View className="ps-7">
				{group.entries.map((entry) => (
					<EntryRow
						key={entry.key}
						entry={entry}
						merged={merged}
						included={!excluded.has(entry.key)}
						onToggle={onToggle}
					/>
				))}
			</View>
		</View>
	);
}

type EntryRowProps = {
	entry: ReviewEntry;
	merged: ProfileData;
	included: boolean;
	onToggle: (keys: string[], included: boolean) => void;
};

function EntryRow({ entry, merged, included, onToggle }: EntryRowProps) {
	const { title, meta } = useReviewEntry(entry, merged);
	return (
		<ControlField
			isSelected={included}
			onSelectedChange={(selected) => onToggle([entry.key], selected)}
			className="min-h-11 items-start px-2 py-1.5"
		>
			<ControlField.Indicator className="mt-0.5">
				<Checkbox />
			</ControlField.Indicator>
			<View className={cx("min-w-0 flex-1", !included && "opacity-60")}>
				<Label>{title}</Label>
				{meta ? (
					<Text size="xs" tone="muted">
						{meta}
					</Text>
				) : null}
			</View>
		</ControlField>
	);
}

function useReviewEntry(entry: ReviewEntry, merged: ProfileData): { title: string; meta: string } {
	const { t } = useLingui();
	const basicsLabel: Record<ProfileBasicsField, string> = {
		name: t`Full name`,
		headline: t`Headline`,
		email: t`Email`,
		phone: t`Phone`,
		location: t`Location`,
		website: t`Website`,
		customFields: t`Other details`,
	};
	if (entry.kind === "basics") {
		const basics = merged.basics;
		const value =
			entry.field === "website"
				? basics.website.url
				: entry.field === "customFields"
					? basics.customFields
							.map((field) => field.text)
							.filter(Boolean)
							.join(" · ")
					: basics[entry.field];
		return { title: value, meta: basicsLabel[entry.field] };
	}
	if (entry.kind === "summary") {
		const text = stripHtml(merged.summary.content).trim();
		return { title: text.length > 220 ? `${text.slice(0, 220)}…` : text, meta: "" };
	}
	const item = merged.sections[entry.section].find((candidate) => candidate.id === entry.id);
	return item ? describeEntry(entry.section, item as unknown as Entry) : { title: "", meta: "" };
}
