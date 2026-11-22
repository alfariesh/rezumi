import type { DesignWrite } from "./write";
import type { TemplateFilter } from "@rezumi/resume/design-presets";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { CareerField } from "@rezumi/schema/templates";

/** What every Design group and sub-screen gets: the resume, how to change it, and whether it is read-only. */
export type DesignProps = { data: ResumeData; write: DesignWrite; disabled: boolean };

/** The template gallery's filters: field of work and layout. */
export type GalleryFilter = { field: CareerField | "all"; layout: TemplateFilter };
