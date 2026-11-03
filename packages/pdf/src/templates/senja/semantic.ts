import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const senjaSemanticManifest = baseManifest("senja", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
