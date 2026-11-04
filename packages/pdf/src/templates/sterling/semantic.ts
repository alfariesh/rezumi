import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const sterlingSemanticManifest = baseManifest("sterling", [
	itemHeaderRowPart,
]) satisfies TemplateSemanticManifest;
