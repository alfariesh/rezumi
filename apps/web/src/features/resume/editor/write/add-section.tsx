import type { WriteSource } from "./source";
import type { ProfileSectionType } from "@rezumi/schema/profile/data";
import type { CustomSectionType, SectionType } from "@rezumi/schema/resume/data";
import type { IconName } from "@rezumi/ui/components/icon";
import { Button, Dropdown, Header, Label, Link, Separator } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { PanelSection } from "../chrome/panel-section";
import { useEditorStore } from "../store";
import { openEntry } from "./actions";
import {
	addBuiltinSection,
	addCustomSection,
	BUILTIN_SECTION_TYPES,
	CUSTOM_SECTION_TYPES,
	ensurePlaced,
	isSectionInUse,
} from "./model";
import { sectionParts, takeProfileParts, useBuilderProfile, useSectionsFromProfile } from "./profile-link";
import { useWriteSelector, useWriteSource } from "./source";
import { getSectionTitle } from "@/libs/resume/section";

const SECTION_ICONS: Record<CustomSectionType, IconName> = {
	summary: "text-align-left",
	experience: "briefcase",
	education: "graduation-cap",
	projects: "graph",
	skills: "lightning",
	languages: "translate",
	interests: "bookmark-simple",
	awards: "check-circle",
	certifications: "list-checks",
	publications: "file-text",
	volunteer: "user-circle",
	references: "phone",
	profiles: "link-simple-horizontal",
	"cover-letter": "envelope-simple",
};

/** Adds a built-in section (or the summary), opens it and focuses its first field. */
function addSection(source: WriteSource, type: "summary" | SectionType) {
	let entryId: string | null = null;
	source.update(
		(draft) => {
			entryId = addBuiltinSection(draft, type);
		},
		{ newStep: true },
	);

	const editor = useEditorStore.getState();
	editor.markSectionAdded(type);
	editor.setSectionOpen(type, true);
	if (entryId) openEntry(type, entryId, { focus: true });
	else requestAnimationFrame(() => document.querySelector<HTMLElement>(`#sidebar-${type} [role="textbox"]`)?.focus());
}

function addCustom(source: WriteSource, type: CustomSectionType) {
	let ids = { sectionId: "", entryId: "" };
	source.update(
		(draft) => {
			ids = addCustomSection(draft, type, getSectionTitle(type));
		},
		{ newStep: true },
	);
	openEntry(ids.sectionId, ids.entryId, { focus: true });
}

/**
 * Add section: every section not in use, in two columns, plus Custom section, which asks for a type. Once every
 * section is in use, the custom types are listed directly. The new section starts with one draft entry, open and
 * focused. In a resume, sections the Profile has content for can come over with it ("From your Profile"); the
 * Profile itself has no custom sections.
 */
export function AddSectionMenu() {
	const source = useWriteSource();
	const document = source.kind === "resume";
	const profile = useBuilderProfile();
	const added = useEditorStore((state) => state.addedSections);
	const unusedKey = useWriteSelector((data) =>
		(["summary", ...BUILTIN_SECTION_TYPES] as const)
			.filter((type) => !isSectionInUse(data, type, new Set(added)))
			.join(","),
	);
	const unused = unusedKey ? (unusedKey.split(",") as ("summary" | SectionType)[]) : [];
	const fromProfile = useSectionsFromProfile(unused as ("summary" | ProfileSectionType)[]);
	const addFromProfile = (type: "summary" | ProfileSectionType) => {
		if (!profile) return;
		takeProfileParts(source, profile, sectionParts(profile, type), (draft) => {
			ensurePlaced(draft, type);
			if (type === "summary") draft.summary.hidden = false;
			else draft.sections[type].hidden = false;
		});
		useEditorStore.getState().setSectionOpen(type, true);
	};
	// The Profile has no custom sections: with every built-in one in use, there is nothing left to add.
	if (!document && unused.length === 0) return null;
	const customItems = CUSTOM_SECTION_TYPES.map((type) => (
		<Dropdown.Item key={type} id={type} textValue={getSectionTitle(type)} onAction={() => addCustom(source, type)}>
			<Icon name={SECTION_ICONS[type]} className="text-muted" />
			<Label>{getSectionTitle(type)}</Label>
		</Dropdown.Item>
	));

	return (
		<Dropdown>
			<Button variant="outline" fullWidth className="border-dashed">
				<Icon name="plus" size={18} />
				<Trans>Add section</Trans>
			</Button>
			<Dropdown.Popover placement="bottom start" className="min-w-[320px]">
				<Dropdown.Menu>
					{fromProfile.length > 0 && (
						<Dropdown.Section>
							<Header>
								<Trans>From your Profile</Trans>
							</Header>
							{fromProfile.map(({ type, count }) => (
								<Dropdown.Item
									key={`profile-${type}`}
									id={`profile-${type}`}
									textValue={getSectionTitle(type)}
									onAction={() => addFromProfile(type)}
								>
									<Icon name={SECTION_ICONS[type]} className="text-muted" />
									<Label>{getSectionTitle(type)}</Label>
									{type !== "summary" && (
										<span className="ms-auto text-xs text-muted">
											{plural(count, { one: "# entry", other: "# entries" })}
										</span>
									)}
								</Dropdown.Item>
							))}
						</Dropdown.Section>
					)}
					{fromProfile.length > 0 && unused.length > 0 && <Separator />}
					{unused.length > 0 && (
						<Dropdown.Section className="grid grid-cols-2">
							{fromProfile.length > 0 && (
								<Header className="col-span-2">
									<Trans>Start empty</Trans>
								</Header>
							)}
							{unused.map((type) => (
								<Dropdown.Item
									key={type}
									id={type}
									textValue={getSectionTitle(type)}
									onAction={() => addSection(source, type)}
								>
									<Icon name={SECTION_ICONS[type]} className="text-muted" />
									<Label>{getSectionTitle(type)}</Label>
								</Dropdown.Item>
							))}
						</Dropdown.Section>
					)}
					{document && unused.length > 0 && <Separator />}
					{!document ? null : unused.length > 0 ? (
						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="custom" textValue={t`Custom section`}>
								<Icon name="plus" className="text-muted" />
								<Label>
									<Trans>Custom section</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover className="w-56">
								<Dropdown.Menu>
									<Dropdown.Section>
										<Header>
											<Trans>What goes in it?</Trans>
										</Header>
										{customItems}
									</Dropdown.Section>
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>
					) : (
						// Every built-in section is in use, so the custom types are the only choice: list them here.
						<Dropdown.Section className="grid grid-cols-2">
							<Header className="col-span-2">
								<Trans>Custom section</Trans>
							</Header>
							{customItems}
						</Dropdown.Section>
					)}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

const SUGGESTED: ("summary" | SectionType)[] = ["experience", "education", "skills", "summary"];

type StartSuggestionsProps = {
	/** Offers to import a resume instead; left out where importing has its own place (the Profile). */
	onImport?: (() => void) | undefined;
};

/** A blank resume or Profile: the first sections to add, as + chips, and an offer to import instead. */
export function StartSuggestions({ onImport }: StartSuggestionsProps) {
	const source = useWriteSource();
	return (
		<PanelSection icon="rows" title={<Trans>Sections</Trans>}>
			<div className="grid gap-3">
				<p className="text-body-sm text-muted">
					{source.kind === "profile" ? (
						<Trans>Start with the sections most resumes have. New resumes start from them.</Trans>
					) : (
						<Trans>Start with the sections most resumes have.</Trans>
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					{SUGGESTED.map((type) => (
						<Button key={type} variant="secondary" size="sm" onPress={() => addSection(source, type)}>
							<Icon name="plus" size={16} />
							{getSectionTitle(type)}
						</Button>
					))}
				</div>
				{onImport && (
					<p className="text-body-xs text-muted">
						<Trans>
							Have a resume already?{" "}
							<Link className="text-xs font-medium" onPress={onImport}>
								Import it
							</Link>
						</Trans>
					</p>
				)}
			</div>
		</PanelSection>
	);
}
