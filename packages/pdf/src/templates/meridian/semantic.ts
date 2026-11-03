import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const meridianSemanticManifest = baseManifest("meridian", [
	itemHeaderRowPart,
]) satisfies TemplateSemanticManifest;
