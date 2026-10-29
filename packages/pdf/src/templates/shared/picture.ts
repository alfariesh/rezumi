import type { ResumeData } from "@rezumi/schema/resume/data";

export const hasTemplatePicture = (picture: ResumeData["picture"]) => !picture.hidden && picture.url.trim() !== "";
