import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const vectorSemanticManifest = baseManifest("vector", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
