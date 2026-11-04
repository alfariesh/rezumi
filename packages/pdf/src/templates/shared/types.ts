import type { ResumeIcon } from "../../forme/icons";
import type { StyleInput, TemplatePlacement } from "./styles";
import type { CustomSection as SchemaCustomSection } from "@rezumi/schema/resume/data";
import type { ComponentProps } from "react";

export type TemplateColorRoles = {
	foreground: string;
	background: string;
	primary: string;
	sidebarForeground?: string | undefined;
	sidebarBackground?: string | undefined;
};

export type TemplateStyleContext = {
	placement: TemplatePlacement;
	colors: TemplateColorRoles;
};

export type TemplateStyleSlot = StyleInput | ((context: TemplateStyleContext) => StyleInput);

export type TemplateIconProps = Omit<ComponentProps<typeof ResumeIcon>, "name">;

export type TemplateIconSlot =
	| Partial<TemplateIconProps>
	| ((context: TemplateStyleContext) => Partial<TemplateIconProps>);

export type TemplateFeatures = {
	/** Contact lines without an icon keep the icon's room, so every line's text starts in one column (Wibawa). */
	contactIconColumn?: boolean;
	/** Publications are numbered, each entry hanging from its number (Cendekia). */
	numberedPublications?: boolean;
	sectionTimeline?: boolean;
	stackSidebarItemHeader?: boolean;
	skillLevelAfterName?: boolean;
};

export type SectionTimelineStyleSlots = {
	items?: TemplateStyleSlot;
	line?: TemplateStyleSlot;
	item?: TemplateStyleSlot;
	marker?: TemplateStyleSlot;
	dot?: TemplateStyleSlot;
	content?: TemplateStyleSlot;
};

export type TemplateFeatureStyleSlots = {
	sectionTimeline?: SectionTimelineStyleSlots;
};

export type TemplateStyleSlots = {
	page?: TemplateStyleSlot;
	text?: TemplateStyleSlot;
	heading?: TemplateStyleSlot;
	div?: TemplateStyleSlot;
	inline?: TemplateStyleSlot;
	link?: TemplateStyleSlot;
	small?: TemplateStyleSlot;
	bold?: TemplateStyleSlot;
	richParagraph?: TemplateStyleSlot;
	richListItemRow?: TemplateStyleSlot;
	richListItemMarker?: TemplateStyleSlot;
	richListItemContent?: TemplateStyleSlot;
	splitRow?: TemplateStyleSlot;
	alignEnd?: TemplateStyleSlot;
	inlineItemHeader?: TemplateStyleSlot;
	inlineItemHeaderLeading?: TemplateStyleSlot;
	inlineItemHeaderMiddle?: TemplateStyleSlot;
	inlineItemHeaderTrailing?: TemplateStyleSlot;
	sectionItemHeader?: TemplateStyleSlot;
	section?: TemplateStyleSlot;
	sectionHeading?: TemplateStyleSlot;
	sectionHeadingContainer?: TemplateStyleSlot;
	sectionHeadingIcon?: TemplateIconSlot;
	/** A shape drawn before the section title, such as a short accent bar. */
	sectionHeadingMarker?: TemplateStyleSlot;
	/** A rule drawn after the section title, filling the rest of its line. */
	sectionHeadingRule?: TemplateStyleSlot;
	/** The row of a skill's keyword chips, and each chip (Skills → keywords as tags). */
	tagList?: TemplateStyleSlot;
	tag?: TemplateStyleSlot;
	/** The label of a labelled custom contact field ("Date of birth"). */
	contactLabel?: TemplateStyleSlot;
	sectionItems?: TemplateStyleSlot;
	item?: TemplateStyleSlot;
	/** The summary's text, when a template sets it apart from the body (Aksara's standfirst). */
	summary?: TemplateStyleSlot;
	levelContainer?: TemplateStyleSlot;
	levelItem?: TemplateStyleSlot;
	levelItemActive?: TemplateStyleSlot;
	levelItemInactive?: TemplateStyleSlot;
	icon?: TemplateIconSlot;
	/** Icons of the contact line, when they need another look than the item icons (a header band). */
	contactIcon?: TemplateIconSlot;
};

export type ItemSection<T> = {
	title: string;
	columns: number;
	hidden: boolean;
	items: T[];
};

export type CustomItemSection<T> = Omit<SchemaCustomSection, "items"> & ItemSection<T>;
