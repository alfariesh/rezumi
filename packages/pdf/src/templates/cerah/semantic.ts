import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const cerahSemanticManifest = baseManifest("cerah", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
