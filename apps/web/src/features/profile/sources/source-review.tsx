import type { PhotoCandidate, ReviewEntry, ReviewGroup } from "./model";
import type { Entry } from "@/features/resume/editor/write/model";
import type { ProfileBasicsField, ProfileData } from "@rezumi/schema/profile/data";
import { Checkbox, Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { stripHtml } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { photoSourceLabel } from "./messages";
import { describeEntry } from "@/features/resume/editor/write/model";
import { UserAvatar } from "@/features/user/avatar";
import { ENTER_CLASS, stagger } from "@/libs/motion";
import { getSectionTitle, SECTION_ICONS } from "@/libs/resume/section";

/** The radio value for keeping no photo. */
const NO_PHOTO = "";

/** A photo choice: round, ringed in the accent while it's the one kept. */
const PHOTO_CLASS =
	"size-16 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface-secondary transition-[box-shadow] duration-quick group-data-[selected=true]/photo:ring-accent";

type SourceReviewProps = {
	merged: ProfileData;
	groups: ReviewGroup[];
	/** Keys of the entries unticked; everything starts ticked. */
	excluded: ReadonlySet<string>;
	onExcludedChange: (excluded: Set<string>) => void;
	photos: PhotoCandidate[];
	/** The photo kept, or null for none. */
	photo: string | null;
	onPhotoChange: (url: string | null) => void;
	/** The person's name, for the photo previews' fallback. */
	name: string;
};

/**
 * What the sources found, by part, everything ticked: untick what shouldn't go in the Profile. Nothing is saved until
 * the person goes on. Shared by onboarding and the Profile's empty state.
 */
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
		<div className="grid gap-3">
			{photos.length > 0 && <PhotoChoice photos={photos} photo={photo} onPhotoChange={onPhotoChange} name={name} />}
			{groups.map((group, index) => (
				<ReviewGroupBlock
					key={group.id}
					group={group}
					merged={merged}
					excluded={excluded}
					onToggle={setEntries}
					index={index + (photos.length > 0 ? 1 : 0)}
				/>
			))}
		</div>
	);
}

type PhotoChoiceProps = Pick<SourceReviewProps, "photos" | "photo" | "onPhotoChange" | "name">;

function PhotoChoice({ photos, photo, onPhotoChange, name }: PhotoChoiceProps) {
	const labelId = useId();
	return (
		<section
			aria-labelledby={labelId}
			className={cn(ENTER_CLASS, "grid gap-3 rounded-xl bg-surface-secondary p-4 fields-on-card")}
		>
			<span id={labelId} className="flex items-center gap-2 text-sm font-semibold">
				<Icon name="image" size={18} className="text-muted" />
				<Trans>Photo</Trans>
			</span>
			<RadioGroup
				aria-labelledby={labelId}
				orientation="horizontal"
				variant="secondary"
				value={photo ?? NO_PHOTO}
				onChange={(value) => onPhotoChange(value === NO_PHOTO ? null : value)}
				className="flex flex-wrap gap-3"
			>
				{photos.map((candidate) => (
					<Radio key={candidate.url} value={candidate.url} className="group/photo m-0">
						<Radio.Content className="flex-col items-center gap-1.5">
							<span className="relative">
								<UserAvatar name={name} image={candidate.url} className={PHOTO_CLASS} />
								<Radio.Control className="absolute -end-1 -bottom-1">
									<Radio.Indicator />
								</Radio.Control>
							</span>
							<span className="text-xs text-muted">{photoSourceLabel(candidate.source)}</span>
						</Radio.Content>
					</Radio>
				))}
				<Radio value={NO_PHOTO} className="group/photo m-0">
					<Radio.Content className="flex-col items-center gap-1.5">
						<span className="relative">
							<span className={cn(PHOTO_CLASS, "grid place-items-center bg-default text-muted")}>
								<Icon name="prohibit" size={22} />
							</span>
							<Radio.Control className="absolute -end-1 -bottom-1">
								<Radio.Indicator />
							</Radio.Control>
						</span>
						<span className="text-xs text-muted">
							<Trans>No photo</Trans>
						</span>
					</Radio.Content>
				</Radio>
			</RadioGroup>
		</section>
	);
}

type ReviewGroupBlockProps = {
	group: ReviewGroup;
	merged: ProfileData;
	excluded: ReadonlySet<string>;
	onToggle: (keys: string[], included: boolean) => void;
	index: number;
};

const COMPACT_GROUPS = new Set(["skills", "languages", "interests", "profiles"]);

function ReviewGroupBlock({ group, merged, excluded, onToggle, index }: ReviewGroupBlockProps) {
	const keys = group.entries.map((entry) => entry.key);
	const kept = keys.filter((key) => !excluded.has(key)).length;
	const title = group.id === "details" ? t`Your details` : getSectionTitle(group.id);
	const icon = group.id === "details" ? "user-circle" : SECTION_ICONS[group.id];

	return (
		<section
			aria-label={title}
			className={cn(ENTER_CLASS, "grid gap-1 rounded-xl bg-surface-secondary p-2 fields-on-card")}
			style={stagger(index)}
		>
			<Checkbox
				isSelected={kept === keys.length}
				isIndeterminate={kept > 0 && kept < keys.length}
				onChange={(selected) => onToggle(keys, selected)}
				className="rounded-lg px-2 py-1.5"
			>
				<Checkbox.Content className="w-full">
					<Checkbox.Control>
						<Checkbox.Indicator />
					</Checkbox.Control>
					<Icon name={icon} size={18} className="text-muted" />
					<span className="text-sm font-semibold">{title}</span>
					<span className="ms-auto text-xs text-muted tabular-nums">
						<Trans>
							{kept} of {keys.length}
						</Trans>
					</span>
				</Checkbox.Content>
			</Checkbox>
			<ul className={cn("grid gap-0.5 ps-7", COMPACT_GROUPS.has(group.id) && "sm:grid-cols-2")}>
				{group.entries.map((entry) => (
					<li key={entry.key}>
						<EntryRow entry={entry} merged={merged} included={!excluded.has(entry.key)} onToggle={onToggle} />
					</li>
				))}
			</ul>
		</section>
	);
}

type EntryRowProps = {
	entry: ReviewEntry;
	merged: ProfileData;
	included: boolean;
	onToggle: (keys: string[], included: boolean) => void;
};

function EntryRow({ entry, merged, included, onToggle }: EntryRowProps) {
	const { title, meta } = describeReviewEntry(entry, merged);
	return (
		<Checkbox
			isSelected={included}
			onChange={(selected) => onToggle([entry.key], selected)}
			className="rounded-lg px-2 py-1.5"
		>
			<Checkbox.Content className="items-start">
				<Checkbox.Control className="mt-0.5">
					<Checkbox.Indicator />
				</Checkbox.Control>
				<span className={cn("grid min-w-0 transition-opacity duration-quick", !included && "opacity-60")}>
					<span className="text-sm font-medium break-words">{title}</span>
					{meta && <span className="text-body-xs break-words text-muted">{meta}</span>}
				</span>
			</Checkbox.Content>
		</Checkbox>
	);
}

const basicsLabel = (field: ProfileBasicsField) => {
	switch (field) {
		case "name":
			return t`Full name`;
		case "headline":
			return t`Headline`;
		case "email":
			return t`Email`;
		case "phone":
			return t`Phone`;
		case "location":
			return t`Location`;
		case "website":
			return t`Website`;
		case "customFields":
			return t`Other details`;
	}
};

/** An entry at a glance: what it is, and the line that tells it apart. */
function describeReviewEntry(entry: ReviewEntry, merged: ProfileData): { title: string; meta: string } {
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
		return { title: value, meta: basicsLabel(entry.field) };
	}
	if (entry.kind === "summary") {
		const text = stripHtml(merged.summary.content).trim();
		return { title: text.length > 220 ? `${text.slice(0, 220)}…` : text, meta: "" };
	}
	const item = merged.sections[entry.section].find((candidate) => candidate.id === entry.id);
	return item ? describeEntry(entry.section, item as Entry) : { title: "", meta: "" };
}
