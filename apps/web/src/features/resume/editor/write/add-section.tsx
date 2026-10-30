import type { CustomSectionType, SectionType } from "@rezumi/schema/resume/data";
import type { IconName } from "@rezumi/ui/components/icon";
import { Widget } from "@heroui-pro/react";
import { Button, Dropdown, Header, Label, Link, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { useEditorStore } from "../store";
import { openEntry } from "./actions";
import {
	addBuiltinSection,
	addCustomSection,
	BUILTIN_SECTION_TYPES,
	CUSTOM_SECTION_TYPES,
	isSectionInUse,
} from "./model";
import { useCurrentBuilderResumeSelector, useResumeStore } from "@/features/resume/builder/draft";
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
function addSection(type: "summary" | SectionType) {
	let entryId: string | null = null;
	useResumeStore.getState().updateResumeData(
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

function addCustom(type: CustomSectionType) {
	let ids = { sectionId: "", entryId: "" };
	useResumeStore.getState().updateResumeData(
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
 * focused.
 */
export function AddSectionMenu() {
	const added = useEditorStore((state) => state.addedSections);
	const unusedKey = useCurrentBuilderResumeSelector((resume) =>
		(["summary", ...BUILTIN_SECTION_TYPES] as const)
			.filter((type) => !isSectionInUse(resume.data, type, new Set(added)))
			.join(","),
	);
	const unused = unusedKey ? (unusedKey.split(",") as ("summary" | SectionType)[]) : [];
	const customItems = CUSTOM_SECTION_TYPES.map((type) => (
		<Dropdown.Item key={type} id={type} textValue={getSectionTitle(type)} onAction={() => addCustom(type)}>
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
					{unused.length > 0 && (
						<Dropdown.Section className="grid grid-cols-2">
							{unused.map((type) => (
								<Dropdown.Item key={type} id={type} textValue={getSectionTitle(type)} onAction={() => addSection(type)}>
									<Icon name={SECTION_ICONS[type]} className="text-muted" />
									<Label>{getSectionTitle(type)}</Label>
								</Dropdown.Item>
							))}
						</Dropdown.Section>
					)}
					{unused.length > 0 && <Separator />}
					{unused.length > 0 ? (
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

/** A blank resume: the first sections to add, as + chips, and an offer to import instead. */
export function StartSuggestions({ onImport }: { onImport: () => void }) {
	return (
		<Widget role="region" aria-label={t`Sections`}>
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					<Icon name="rows" size={16} className="shrink-0 text-muted" />
					<Widget.Title>
						<Trans>Sections</Trans>
					</Widget.Title>
				</span>
			</Widget.Header>
			<Widget.Content className="grid gap-3">
				<p className="text-sm text-muted">
					<Trans>Start with the sections most resumes have.</Trans>
				</p>
				<div className="flex flex-wrap gap-2">
					{SUGGESTED.map((type) => (
						<Button key={type} variant="secondary" size="sm" onPress={() => addSection(type)}>
							<Icon name="plus" size={16} />
							{getSectionTitle(type)}
						</Button>
					))}
				</div>
				<p className="text-xs text-muted">
					<Trans>
						Have a resume already?{" "}
						<Link className="text-xs font-medium" onPress={onImport}>
							Import it
						</Link>
					</Trans>
				</p>
			</Widget.Content>
		</Widget>
	);
}
