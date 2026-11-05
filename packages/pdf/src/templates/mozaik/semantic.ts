import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const mozaikSemanticManifest = baseManifest("mozaik", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
