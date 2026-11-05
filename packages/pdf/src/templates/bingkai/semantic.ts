import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const bingkaiSemanticManifest = baseManifest("bingkai", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
