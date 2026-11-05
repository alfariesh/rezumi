import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const terasSemanticManifest = baseManifest("teras", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
