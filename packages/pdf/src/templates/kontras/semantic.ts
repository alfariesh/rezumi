import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const kontrasSemanticManifest = baseManifest("kontras", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
