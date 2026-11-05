import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const cobaltSemanticManifest = baseManifest("cobalt", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
