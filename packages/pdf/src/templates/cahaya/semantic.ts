import type { TemplateSemanticManifest } from "../../semantic/template-manifest";
import { baseManifest, itemHeaderRowPart } from "../../semantic/shared-parts";

export const cahayaSemanticManifest = baseManifest("cahaya", [itemHeaderRowPart]) satisfies TemplateSemanticManifest;
