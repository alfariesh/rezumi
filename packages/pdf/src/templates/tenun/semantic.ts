import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const tenunSemanticManifest = baseManifest("tenun", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
